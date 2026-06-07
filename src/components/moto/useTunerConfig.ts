import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the hero / vehicle tuner settings.
 * Stored in `site_config.hero_tuner_config` (jsonb) per dealership, so
 * tuning changes broadcast to every visitor of the published site.
 *
 * Falls back to localStorage when offline / unauthenticated so the dev
 * tuner still feels live.
 */
export type TunerConfig = {
  hero?: Record<string, unknown>;
  vehicle?: Record<string, unknown>;
  [k: string]: unknown;
};

const LS_KEY = "moto-tuner-config-v1";
// Namespace the cache by tenant so one dealership's tuner config can't flash
// into another's hero/vehicle layout in the same browser.
const lsKeyFor = (dealershipId?: string | null) => (dealershipId ? `${LS_KEY}:${dealershipId}` : LS_KEY);
const LOCAL_EVENT = "moto-tuner-config:change";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type RealtimeStatus = "connecting" | "live" | "closed" | "error";

export function useTunerConfig(dealershipId: string | undefined | null) {
  const [config, setConfig] = useState<TunerConfig>(() => {
    try {
      const raw = localStorage.getItem(lsKeyFor(dealershipId));
      return raw ? (JSON.parse(raw) as TunerConfig) : {};
    } catch {
      return {};
    }
  });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [realtime, setRealtime] = useState<RealtimeStatus>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<TunerConfig>(config);
  latestRef.current = config;

  useEffect(() => {
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<TunerConfig>).detail;
      if (detail) setConfig(detail);
    };
    window.addEventListener(LOCAL_EVENT, onLocal);
    return () => window.removeEventListener(LOCAL_EVENT, onLocal);
  }, []);

  useEffect(() => {
    if (!dealershipId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("site_config")
        .select("hero_tuner_config")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (cancelled) return;
      const remote = (data?.hero_tuner_config ?? {}) as TunerConfig;
      setConfig(remote);
      try {
        localStorage.setItem(lsKeyFor(dealershipId), JSON.stringify(remote));
      } catch { /* localStorage unavailable */ }
      setLoaded(true);
    })();

    setRealtime("connecting");
    const channel = supabase
      .channel(`site_config:${dealershipId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_config",
          filter: `dealership_id=eq.${dealershipId}`,
        },
        (payload) => {
          const next = (payload.new as { hero_tuner_config?: TunerConfig })
            ?.hero_tuner_config;
          if (next) {
            setConfig(next);
            setLastUpdatedAt(Date.now());
            try {
              localStorage.setItem(lsKeyFor(dealershipId), JSON.stringify(next));
            } catch { /* localStorage unavailable */ }
          }
        },
      )
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setRealtime("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setRealtime("error");
        else if (s === "CLOSED") setRealtime("closed");
      });

    return () => {
      cancelled = true;
      setRealtime("closed");
      supabase.removeChannel(channel);
    };
  }, [dealershipId]);

  const persist = useCallback(
    (next: TunerConfig) => {
      try {
        localStorage.setItem(lsKeyFor(dealershipId), JSON.stringify(next));
      } catch { /* localStorage unavailable */ }
      if (!dealershipId) return;
      setStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      saveTimer.current = setTimeout(async () => {
        const { error } = await supabase.rpc("set_hero_tuner_config", {
          p_dealership_id: dealershipId,
          p_config: next as never,
        });
        if (error) {
          console.warn("[tuner] remote save failed (kept locally):", error.message);
          setStatus("error");
        } else {
          setStatus("saved");
          setLastUpdatedAt(Date.now());
          savedTimer.current = setTimeout(() => setStatus("idle"), 1500);
        }
      }, 400);
    },
    [dealershipId],
  );

  const update = useCallback(
    (section: "hero" | "vehicle" | "heroVehicle", value: Record<string, unknown>) => {
      const next: TunerConfig = {
        ...latestRef.current,
        [section]: value,
      };
      setConfig(next);
      window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: next }));
      persist(next);
    },
    [persist],
  );


  return { config, loaded, update, status, realtime, lastUpdatedAt };
}


