import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-tenant live status: shows every dealership_id with a hero tuner config,
 * its bound custom domain, the last DB write time, and a reachability ping
 * confirming the live host is serving requests. The active dealership_id
 * (the one this tuner is editing) is highlighted.
 *
 * All visitors read `site_config.hero_tuner_config` from the same DB, so a
 * green row = that tenant's live site is rendering whatever is in this row.
 */

type Row = {
  dealership_id: string;
  display_name: string | null;
  slug: string | null;
  custom_domain: string | null;
  updated_at: string | null;
  hero_size: number | null;
  vehicle_2xl: string | null;
};

type PingStatus = "idle" | "checking" | "ok" | "fail";

const formatVehicle2xl = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  if (!value || typeof value !== "object") return null;
  const row = value as { w?: unknown; gap?: unknown };
  const width = typeof row.w === "number" && Number.isFinite(row.w) ? `${row.w}px` : null;
  const gap = typeof row.gap === "number" && Number.isFinite(row.gap) ? `gap ${row.gap}px` : null;
  return [width, gap].filter(Boolean).join(" · ") || null;
};

export default function TenantLiveStatus({
  activeDealershipId,
}: {
  activeDealershipId: string | undefined | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pings, setPings] = useState<Record<string, { status: PingStatus; at: number | null; err?: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: tenants } = await supabase
      .from("tenants")
      .select("dealership_id, display_name, slug, custom_domain")
      .order("dealership_id");
    const { data: configs } = await supabase
      .from("site_config")
      .select("dealership_id, updated_at, hero_tuner_config");

    const cfgMap = new Map<string, { updated_at: string | null; cfg: Record<string, unknown> }>();
    (configs ?? []).forEach((c) =>
      cfgMap.set(c.dealership_id, { updated_at: c.updated_at, cfg: c.hero_tuner_config }),
    );

    const merged: Row[] = (tenants ?? []).map((t) => {
      const c = cfgMap.get(t.dealership_id);
      const cfg = c?.cfg ?? {};
      const hero = cfg.hero && typeof cfg.hero === "object" ? cfg.hero as Record<string, unknown> : {};
      const vehicle = cfg.vehicle && typeof cfg.vehicle === "object" ? cfg.vehicle as Record<string, unknown> : {};
      return {
        dealership_id: t.dealership_id,
        display_name: t.display_name,
        slug: t.slug,
        custom_domain: t.custom_domain,
        updated_at: c?.updated_at ?? null,
        hero_size: typeof hero.size === "number" ? hero.size : null,
        vehicle_2xl: formatVehicle2xl(vehicle["2xl"]),
      };
    });

    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pingOne = useCallback(async (row: Row) => {
    if (!row.custom_domain) return;
    setPings((p) => ({ ...p, [row.dealership_id]: { status: "checking", at: null } }));
    try {
      await fetch(`https://${row.custom_domain}/?_status=${Date.now()}`, {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
      });
      setPings((p) => ({
        ...p,
        [row.dealership_id]: { status: "ok", at: Date.now() },
      }));
    } catch (e) {
      setPings((p) => ({
        ...p,
        [row.dealership_id]: {
          status: "fail",
          at: Date.now(),
          err: e instanceof Error ? e.message : String(e),
        },
      }));
    }
  }, []);

  const pingAll = useCallback(() => {
    rows.forEach((r) => {
      if (r.custom_domain) pingOne(r);
    });
  }, [rows, pingOne]);

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-2 text-[11px]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wider text-zinc-500">
          Tenant live status
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={load}
            className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-100"
          >
            ↻ refresh
          </button>
          <button
            type="button"
            onClick={pingAll}
            className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-100"
          >
            ping all
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading tenants…</div>
      ) : rows.length === 0 ? (
        <div className="text-zinc-400">No tenants found.</div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => {
            const isActive = r.dealership_id === activeDealershipId;
            const hasCfg = r.hero_size != null || r.vehicle_2xl != null;
            const ping = pings[r.dealership_id];
            return (
              <li
                key={r.dealership_id}
                className={
                  "rounded border px-1.5 py-1 " +
                  (isActive
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-zinc-200 bg-white")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-zinc-800">
                        {r.dealership_id}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-emerald-600 px-1.5 py-[1px] text-[9px] font-bold uppercase text-white">
                          editing
                        </span>
                      )}
                      {!hasCfg && (
                        <span className="rounded-full bg-zinc-200 px-1.5 py-[1px] text-[9px] uppercase text-zinc-600">
                          no config
                        </span>
                      )}
                    </div>
                    <div className="truncate text-zinc-500">
                      {r.display_name ?? r.slug ?? "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    {r.custom_domain ? (
                      <a
                        href={`https://${r.custom_domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {r.custom_domain}
                      </a>
                    ) : (
                      <span className="text-zinc-400">no domain</span>
                    )}
                  </div>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                  <span>
                    hero.size:{" "}
                    <span className="font-mono text-zinc-700">{r.hero_size ?? "—"}</span>
                    <span className="mx-1 text-zinc-300">·</span>
                    vehicle.2xl:{" "}
                    <span className="font-mono text-zinc-700">
                      {r.vehicle_2xl ?? "—"}
                    </span>
                  </span>
                  <span>
                    DB:{" "}
                    {r.updated_at
                      ? new Date(r.updated_at).toLocaleString([], {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "never"}
                  </span>
                </div>

                {r.custom_domain && (
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => pingOne(r)}
                      className="rounded border border-zinc-200 bg-white px-1.5 py-[1px] text-zinc-600 hover:bg-zinc-100"
                    >
                      ping
                    </button>
                    <span
                      title={ping?.err ?? undefined}
                      className={
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] font-medium " +
                        (ping?.status === "ok"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : ping?.status === "checking"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : ping?.status === "fail"
                              ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                              : "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200")
                      }
                    >
                      {ping?.status === "ok"
                        ? "✓ live"
                        : ping?.status === "checking"
                          ? "…checking"
                          : ping?.status === "fail"
                            ? "✗ unreachable"
                            : "· not pinged"}
                      {ping?.at && ping.status !== "checking" ? (
                        <span className="opacity-60">
                          {" "}
                          {new Date(ping.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-1.5 text-[10px] leading-snug text-zinc-400">
        All tenants read hero tuner config from the same DB. The highlighted row
        is what this tuner is editing right now.
      </div>
    </div>
  );
}
