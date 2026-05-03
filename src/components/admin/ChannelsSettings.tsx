import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Mail, Phone, MicVocal, Loader2, MapPin, Repeat, ShieldCheck, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CHANNEL_KEYS,
  CHANNEL_META,
  ALL_ENABLED,
  type ChannelKey,
  type ChannelStateMap,
} from "@/lib/channels";

const DEFAULT_TCPA_DISCLOSURE =
  "By submitting this form, I consent to receive automated and prerecorded calls, texts, and emails from this dealership and its agents about my vehicle inquiry, including via autodialer, even if my number is on a Do Not Call list. Consent is not a condition of any purchase. Standard message and data rates may apply. Reply STOP to opt out at any time.";

const ICONS: Record<ChannelKey, React.ComponentType<{ className?: string }>> = {
  two_way_sms: MessageSquare,
  two_way_email: Mail,
  ai_phone_calls: MicVocal,
  click_to_dial: Phone,
};

interface DealerLocationLite {
  id: string;
  name: string;
}

type LocationOverrideMap = Record<string, Record<ChannelKey, boolean | null>>;

function emptyOverrides(): Record<ChannelKey, boolean | null> {
  return Object.fromEntries(CHANNEL_KEYS.map((k) => [k, null])) as Record<ChannelKey, boolean | null>;
}

/**
 * Communication channel toggles per dealership and per-store, plus
 * the cadence engine master switch and per-tenant TCPA disclosure.
 *
 * Channel toggles gate staff-initiated messaging (v1 channels:
 * two_way_sms, two_way_email, ai_phone_calls, click_to_dial). Per-store
 * override = Inherit / On / Off.
 *
 * The cadence engine block (PR #140) controls scheduled drips —
 * master on/off, AI voice authorized bump %, and the RE-ENGAGE
 * window length. Granular per-trigger templates and dealer-tz quiet
 * hours still live in Setup · Process → Notifications.
 *
 * The TCPA disclosure block edits site_config.tcpa_disclosure (the
 * consent copy under the lead-gen form). Editing the copy bumps the
 * version, which the cadence engine uses for the 12-month
 * reactivation gate.
 */
const ChannelsSettings = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();

  const [tenantState, setTenantState] = useState<ChannelStateMap>(ALL_ENABLED);
  const [recordCalls, setRecordCalls] = useState(false);
  const [locations, setLocations] = useState<DealerLocationLite[]>([]);
  const [locationOverrides, setLocationOverrides] = useState<LocationOverrideMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Cadence engine (notification_settings) — added with PR #140.
  const [cadenceEnabled, setCadenceEnabled] = useState(true);
  const [cadenceBumpPct, setCadenceBumpPct] = useState<string>("5");
  const [cadenceReengageDays, setCadenceReengageDays] = useState<string>("90");
  const [cadenceDirty, setCadenceDirty] = useState(false);
  const [notificationSettingsId, setNotificationSettingsId] = useState<string | null>(null);

  // TCPA disclosure (site_config) — added with PR #140.
  const [tcpaDisclosure, setTcpaDisclosure] = useState<string>(DEFAULT_TCPA_DISCLOSURE);
  const [tcpaSavedDisclosure, setTcpaSavedDisclosure] = useState<string>(DEFAULT_TCPA_DISCLOSURE);
  const [tcpaVersion, setTcpaVersion] = useState<number>(1);
  const [siteConfigId, setSiteConfigId] = useState<string | null>(null);

  // Demo mode (site_config) — Black Book sandbox kill-switch.
  const [demoMode, setDemoMode] = useState(false);
  const [demoOfferAmount, setDemoOfferAmount] = useState<string>("23599");
  const [demoDirty, setDemoDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: tRows }, { data: locs }, { data: acct }, { data: notif }, { data: site }] = await Promise.all([
        supabase
          .from("tenant_channels")
          .select("channel, enabled")
          .eq("dealership_id", tenant.dealership_id),
        supabase
          .from("dealership_locations")
          .select("id, name")
          .eq("dealership_id", tenant.dealership_id)
          .order("name", { ascending: true }),
        supabase
          .from("dealer_accounts")
          .select("click_to_dial_record_calls")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle(),
        supabase
          .from("notification_settings")
          .select("id, cadence_enabled, cadence_authorized_bump_pct, cadence_reengage_max_days")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle(),
        supabase
          .from("site_config")
          .select("id, tcpa_disclosure, tcpa_disclosure_version, demo_mode, demo_offer_amount")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setRecordCalls(!!acct?.click_to_dial_record_calls);

      const n = (notif || {}) as any;
      setNotificationSettingsId(n?.id ?? null);
      setCadenceEnabled(n?.cadence_enabled ?? true);
      setCadenceBumpPct(String(n?.cadence_authorized_bump_pct ?? 5));
      setCadenceReengageDays(String(n?.cadence_reengage_max_days ?? 90));
      setCadenceDirty(false);

      const s = (site || {}) as any;
      setSiteConfigId(s?.id ?? null);
      const disc = (s?.tcpa_disclosure as string | undefined) || DEFAULT_TCPA_DISCLOSURE;
      setTcpaDisclosure(disc);
      setTcpaSavedDisclosure(disc);
      setTcpaVersion(s?.tcpa_disclosure_version ?? 1);
      setDemoMode(s?.demo_mode === true);
      setDemoOfferAmount(String(s?.demo_offer_amount ?? 23599));
      setDemoDirty(false);

      const t: ChannelStateMap = { ...ALL_ENABLED };
      (tRows || []).forEach((r) => {
        if (CHANNEL_KEYS.includes(r.channel as ChannelKey)) {
          t[r.channel as ChannelKey] = !!r.enabled;
        }
      });
      setTenantState(t);
      setLocations(locs || []);

      // Load per-location overrides for every location in the tenant.
      const ids = (locs || []).map((l) => l.id);
      if (ids.length) {
        const { data: lcRows } = await supabase
          .from("location_channels")
          .select("location_id, channel, enabled")
          .in("location_id", ids);
        if (cancelled) return;
        const m: LocationOverrideMap = {};
        ids.forEach((id) => (m[id] = emptyOverrides()));
        (lcRows || []).forEach((r) => {
          if (m[r.location_id] && CHANNEL_KEYS.includes(r.channel as ChannelKey)) {
            m[r.location_id][r.channel as ChannelKey] = r.enabled;
          }
        });
        setLocationOverrides(m);
      } else {
        setLocationOverrides({});
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  const updateTenantChannel = async (channel: ChannelKey, enabled: boolean) => {
    setSavingKey(`tenant:${channel}`);
    const previous = tenantState[channel];
    setTenantState((s) => ({ ...s, [channel]: enabled })); // optimistic
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("tenant_channels")
      .upsert(
        {
          dealership_id: tenant.dealership_id,
          channel,
          enabled,
          updated_at: new Date().toISOString(),
          updated_by: u?.user?.id ?? null,
        },
        { onConflict: "dealership_id,channel" },
      );
    setSavingKey(null);
    if (error) {
      setTenantState((s) => ({ ...s, [channel]: previous }));
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${CHANNEL_META[channel].label}: ${enabled ? "On" : "Off"}` });
  };

  const updateRecordCalls = async (next: boolean) => {
    setSavingKey("recording");
    const prev = recordCalls;
    setRecordCalls(next); // optimistic
    const { error } = await supabase
      .from("dealer_accounts")
      .update({ click_to_dial_record_calls: next })
      .eq("dealership_id", tenant.dealership_id);
    setSavingKey(null);
    if (error) {
      setRecordCalls(prev);
      toast({ title: "Couldn't save recording preference", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: next ? "Call recording enabled" : "Call recording disabled",
      description: next
        ? "Customers will hear a disclosure before each bridge connects."
        : "Bridged calls will no longer be recorded.",
    });
  };

  const updateLocationChannel = async (
    locationId: string,
    channel: ChannelKey,
    value: boolean | null, // null = inherit
  ) => {
    const key = `loc:${locationId}:${channel}`;
    setSavingKey(key);
    const prev = locationOverrides[locationId]?.[channel] ?? null;
    setLocationOverrides((m) => ({
      ...m,
      [locationId]: { ...(m[locationId] || emptyOverrides()), [channel]: value },
    }));

    const { data: u } = await supabase.auth.getUser();
    let error;
    if (value === null) {
      const res = await supabase
        .from("location_channels")
        .delete()
        .eq("location_id", locationId)
        .eq("channel", channel);
      error = res.error;
    } else {
      const res = await supabase
        .from("location_channels")
        .upsert(
          {
            location_id: locationId,
            channel,
            enabled: value,
            updated_at: new Date().toISOString(),
            updated_by: u?.user?.id ?? null,
          },
          { onConflict: "location_id,channel" },
        );
      error = res.error;
    }
    setSavingKey(null);
    if (error) {
      setLocationOverrides((m) => ({
        ...m,
        [locationId]: { ...(m[locationId] || emptyOverrides()), [channel]: prev },
      }));
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    }
  };

  const saveCadence = async () => {
    setSavingKey("cadence");
    const bumpPct = Number(cadenceBumpPct);
    const reengageDays = Number(cadenceReengageDays);
    if (!Number.isFinite(bumpPct) || bumpPct < 0 || bumpPct > 100) {
      setSavingKey(null);
      toast({ title: "Invalid bump %", description: "Must be 0–100.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(reengageDays) || reengageDays < 1 || reengageDays > 365) {
      setSavingKey(null);
      toast({ title: "Invalid window", description: "Must be 1–365 days.", variant: "destructive" });
      return;
    }

    const payload = {
      dealership_id: tenant.dealership_id,
      cadence_enabled: cadenceEnabled,
      cadence_authorized_bump_pct: bumpPct,
      cadence_reengage_max_days: reengageDays,
      updated_at: new Date().toISOString(),
    };
    const { error, data } = notificationSettingsId
      ? await supabase
          .from("notification_settings")
          .update(payload)
          .eq("id", notificationSettingsId)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("notification_settings")
          .insert(payload as any)
          .select("id")
          .maybeSingle();

    setSavingKey(null);
    if (error) {
      toast({ title: "Couldn't save cadence settings", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.id) setNotificationSettingsId(data.id);
    setCadenceDirty(false);
    toast({ title: "Cadence settings saved" });
  };

  const saveTcpaDisclosure = async () => {
    const trimmed = tcpaDisclosure.trim();
    if (trimmed.length < 40) {
      toast({
        title: "Disclosure too short",
        description: "TCPA disclosure must include the consent + opt-out language.",
        variant: "destructive",
      });
      return;
    }
    setSavingKey("tcpa");
    const copyChanged = trimmed !== tcpaSavedDisclosure.trim();
    const nextVersion = copyChanged ? tcpaVersion + 1 : tcpaVersion;

    const payload: any = {
      dealership_id: tenant.dealership_id,
      tcpa_disclosure: trimmed,
      tcpa_disclosure_version: nextVersion,
      updated_at: new Date().toISOString(),
    };

    const { error, data } = siteConfigId
      ? await supabase
          .from("site_config")
          .update(payload)
          .eq("id", siteConfigId)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("site_config")
          .insert(payload)
          .select("id")
          .maybeSingle();

    setSavingKey(null);
    if (error) {
      toast({ title: "Couldn't save disclosure", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.id) setSiteConfigId(data.id);
    setTcpaSavedDisclosure(trimmed);
    setTcpaVersion(nextVersion);
    toast({
      title: "TCPA disclosure saved",
      description: copyChanged ? `Version bumped to v${nextVersion}.` : undefined,
    });
  };

  const saveDemoMode = async () => {
    const amt = Number(demoOfferAmount);
    if (!Number.isFinite(amt) || amt < 1 || amt > 1_000_000) {
      toast({ title: "Invalid demo offer", description: "Must be 1–1,000,000.", variant: "destructive" });
      return;
    }
    setSavingKey("demo");
    const payload: any = {
      dealership_id: tenant.dealership_id,
      demo_mode: demoMode,
      demo_offer_amount: Math.round(amt),
      updated_at: new Date().toISOString(),
    };

    const runWrite = () => (siteConfigId
      ? supabase
          .from("site_config")
          .update(payload)
          .eq("id", siteConfigId)
          .select("id")
          .maybeSingle()
      : supabase
          .from("site_config")
          .insert(payload)
          .select("id")
          .maybeSingle());

    let { error, data } = await runWrite();

    // PostgREST stale-schema recovery. If the demo_mode/demo_offer_amount
    // columns exist but PostgREST cached the schema before they landed,
    // the write fails with PGRST204 ("Could not find the 'demo_mode'
    // column of 'site_config' in the schema cache"). Call the heal RPC
    // to re-run ALTER TABLE IF NOT EXISTS + NOTIFY pgrst reload, give
    // the cache ~1.2s to refresh, then retry once.
    const looksLikeSchemaCacheMiss = (msg: string) =>
      /demo_mode|demo_offer_amount/i.test(msg) &&
      /(schema cache|could not find the .* column)/i.test(msg);

    if (error && looksLikeSchemaCacheMiss(error.message || "")) {
      try {
        await supabase.rpc("heal_demo_mode_schema" as any);
      } catch (e) {
        console.warn("heal_demo_mode_schema RPC failed:", (e as Error).message);
      }
      await new Promise((r) => setTimeout(r, 1200));
      const retry = await runWrite();
      error = retry.error;
      data = retry.data;
    }

    setSavingKey(null);
    if (error) {
      toast({ title: "Couldn't save demo mode", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.id) setSiteConfigId(data.id);
    setDemoDirty(false);
    toast({
      title: demoMode ? "Demo mode ON" : "Demo mode OFF",
      description: demoMode
        ? `Every offer will display $${Math.round(amt).toLocaleString()} until you turn this off.`
        : "Live Black Book pricing is restored.",
    });
  };

  const tenantName = tenant.display_name;
  const showLocations = locations.length > 1;
  const tcpaDirty = tcpaDisclosure.trim() !== tcpaSavedDisclosure.trim();

  const tenantRows = useMemo(
    () =>
      CHANNEL_KEYS.map((key) => {
        const meta = CHANNEL_META[key];
        const Icon = ICONS[key];
        const enabled = tenantState[key];
        const isSaving = savingKey === `tenant:${key}`;
        const showRecording = key === "click_to_dial";
        const recordingSaving = savingKey === "recording";
        return (
          <div
            key={key}
            className="bg-card border rounded-2xl p-5"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold">{meta.label}</span>
                  <Badge
                    variant="outline"
                    className={
                      enabled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }
                  >
                    {enabled ? "ON" : "OFF"}
                  </Badge>
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{meta.description}</p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => updateTenantChannel(key, v)}
                disabled={isSaving}
                aria-label={`Toggle ${meta.label}`}
              />
            </div>
            {showRecording && enabled && (
              <div className="mt-4 ml-14 pl-4 border-l-2 border-muted">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">Record bridged calls</span>
                      <Badge
                        variant="outline"
                        className={
                          recordCalls
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                            : "bg-slate-100 text-slate-600 border-slate-200 text-[10px]"
                        }
                      >
                        {recordCalls ? "ON" : "OFF"}
                      </Badge>
                      {recordingSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Records the bridged audio in stereo. Customer hears a "this call may be recorded" disclosure before the bridge connects, satisfying two-party-consent jurisdictions (CA, FL, IL, MA, MD, MT, NH, PA, WA + more).
                    </p>
                  </div>
                  <Switch
                    checked={recordCalls}
                    onCheckedChange={updateRecordCalls}
                    disabled={recordingSaving}
                    aria-label="Toggle call recording"
                  />
                </div>
              </div>
            )}
          </div>
        );
      }),
    [tenantState, savingKey, recordCalls],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-bold">
          Setup · Dealer
        </div>
        <h1 className="text-2xl font-bold mt-1">Channels</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          Turn customer-facing communication channels on or off for{" "}
          <span className="font-bold text-foreground">{tenantName}</span>. These
          switches control whether staff can use a channel at all — separate from
          automation rules.
        </p>
      </div>

      <div
        className={`bg-card border rounded-2xl p-5 space-y-4 ${
          demoMode ? "border-amber-300 ring-2 ring-amber-200/60 bg-amber-50/40" : ""
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold">Demo mode</span>
              <Badge
                variant="outline"
                className={
                  demoMode
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }
              >
                {demoMode ? "ON" : "OFF"}
              </Badge>
              {savingKey === "demo" && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Black Book sandbox kill-switch. While ON, the public sell-flow
              skips the BB lookup, serves a synthetic vehicle, and clamps
              every customer-facing offer to the amount below. Cadence
              engine, TCPA capture, and notifications still fire normally
              so end-to-end demos exercise the full pipeline. Turn this
              OFF to restore live Black Book pricing — no other behavior
              changes.
            </p>
          </div>
          <Switch
            checked={demoMode}
            onCheckedChange={(v) => { setDemoMode(v); setDemoDirty(true); }}
            aria-label="Toggle demo mode"
          />
        </div>

        <div className="ml-14 pl-4 border-l-2 border-muted">
          <label className="text-sm font-semibold">Demo offer amount</label>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            Customer-facing offer when demo mode is on. Default $23,599.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min={1}
              max={1000000}
              step={1}
              value={demoOfferAmount}
              onChange={(e) => { setDemoOfferAmount(e.target.value); setDemoDirty(true); }}
              className="w-36"
            />
            <Button
              size="sm"
              onClick={saveDemoMode}
              disabled={!demoDirty || savingKey === "demo"}
              className="ml-auto"
            >
              Save demo mode
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">{tenantRows}</div>

      {showLocations && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-bold">Per-store overrides</h2>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">
            Override the group-level setting for a specific store. Inherit means
            the store follows the tenant default above.
          </p>
          <div className="bg-card border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-semibold px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Store
                  </th>
                  {CHANNEL_KEYS.map((k) => (
                    <th
                      key={k}
                      className="text-left font-semibold px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground"
                    >
                      {CHANNEL_META[k].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} className="border-t">
                    <td className="px-4 py-3 font-medium align-middle">{loc.name}</td>
                    {CHANNEL_KEYS.map((k) => {
                      const override = locationOverrides[loc.id]?.[k] ?? null;
                      const value =
                        override === null ? "inherit" : override ? "on" : "off";
                      const isSaving = savingKey === `loc:${loc.id}:${k}`;
                      return (
                        <td key={k} className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            <Select
                              value={value}
                              disabled={isSaving}
                              onValueChange={(v) =>
                                updateLocationChannel(
                                  loc.id,
                                  k,
                                  v === "inherit" ? null : v === "on",
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-[100px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inherit">
                                  Inherit ({tenantState[k] ? "On" : "Off"})
                                </SelectItem>
                                <SelectItem value="on">On</SelectItem>
                                <SelectItem value="off">Off</SelectItem>
                              </SelectContent>
                            </Select>
                            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 mt-2">
          <Repeat className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-bold">Cadence engine</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-1 max-w-3xl">
          The follow-up sequence engine that drives DECLINED, STALL, and
          RE-ENGAGE drips across email, SMS, and the AI voice agent. Disabling
          the engine pauses all scheduled outbound for this dealership; the
          channel toggles above continue to govern staff-initiated messages.
        </p>
        <div className="bg-card border rounded-2xl p-5 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold">Cadence engine</span>
                <Badge
                  variant="outline"
                  className={
                    cadenceEnabled
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }
                >
                  {cadenceEnabled ? "ON" : "OFF"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Master switch for the orchestrator (`cadence-tick`). Off = no
                scheduled drips fire for any lead.
              </p>
            </div>
            <Switch
              checked={cadenceEnabled}
              onCheckedChange={(v) => { setCadenceEnabled(v); setCadenceDirty(true); }}
              aria-label="Toggle cadence engine"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <label className="text-sm font-semibold flex items-center gap-2">
                Authorized voice bump %
              </label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Maximum % over the original quoted offer the AI voice agent can
                quote on a re-engage call without manager approval. Industry
                norm is 5%.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={cadenceBumpPct}
                  onChange={(e) => { setCadenceBumpPct(e.target.value); setCadenceDirty(true); }}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">RE-ENGAGE window</label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                How many days post-expiry to keep the long-tail drip running
                before a lead is marked expired. KBB ICO baseline is 90.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={cadenceReengageDays}
                  onChange={(e) => { setCadenceReengageDays(e.target.value); setCadenceDirty(true); }}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {savingKey === "cadence" && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
            <Button
              size="sm"
              onClick={saveCadence}
              disabled={!cadenceDirty || savingKey === "cadence"}
            >
              Save cadence settings
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 mt-2">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-bold">TCPA disclosure</h2>
          <Badge variant="outline" className="text-[10px]">v{tcpaVersion}</Badge>
        </div>
        <p className="text-sm text-muted-foreground -mt-1 max-w-3xl">
          Per-tenant consent language shown beneath the lead-gen submit button.
          Required by the FCC 2024 one-to-one rule — consent must name THIS
          dealership. Editing the copy bumps the version; consent older than 12
          months on cold leads pauses SMS/voice until the customer re-consents.
        </p>
        <div className="bg-card border rounded-2xl p-5 space-y-3">
          <Textarea
            value={tcpaDisclosure}
            onChange={(e) => setTcpaDisclosure(e.target.value)}
            rows={6}
            className="text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setTcpaDisclosure(DEFAULT_TCPA_DISCLOSURE)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Reset to default copy
            </button>
            <div className="flex items-center gap-2">
              {savingKey === "tcpa" && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              <Button
                size="sm"
                onClick={saveTcpaDisclosure}
                disabled={!tcpaDirty || savingKey === "tcpa"}
              >
                {tcpaDirty ? `Save (bump to v${tcpaVersion + 1})` : "Saved"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-4 text-xs text-muted-foreground">
        Channel switches above gate staff-initiated messages. The cadence
        engine drives scheduled outbound. Granular per-trigger templates,
        recipients, and dealer-tz quiet hours live in{" "}
        <span className="font-semibold">Setup · Process → Notifications</span>.
      </div>
    </div>
  );
};

export default ChannelsSettings;
