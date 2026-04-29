import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Mail, Phone, MicVocal, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CHANNEL_KEYS,
  CHANNEL_META,
  ALL_ENABLED,
  type ChannelKey,
  type ChannelStateMap,
} from "@/lib/channels";

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
 * Communication channel toggles per dealership and per-store.
 *
 * Tenant-level toggles set the default for every store under the
 * dealership. Per-store override = Inherit / On / Off. v1 channels:
 * two_way_sms, two_way_email, ai_phone_calls, click_to_dial.
 *
 * Toggling a channel here does NOT affect automated outbound (drips,
 * scheduled follow-ups) — that lives in Process · Offer Logic /
 * notification settings.
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: tRows }, { data: locs }, { data: acct }] = await Promise.all([
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
      ]);
      if (cancelled) return;
      setRecordCalls(!!acct?.click_to_dial_record_calls);

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

  const tenantName = tenant.display_name;
  const showLocations = locations.length > 1;

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

      <div className="border-t pt-4 text-xs text-muted-foreground">
        These switches do not affect automated outbound (drip emails, scheduled
        SMS, follow-up sequences). To disable automated outbound, use{" "}
        <span className="font-semibold">Setup · Process</span> → Notifications or
        Offer Logic.
      </div>
    </div>
  );
};

export default ChannelsSettings;
