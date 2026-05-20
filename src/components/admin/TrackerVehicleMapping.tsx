import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_OEM_FLAGSHIPS,
  type FlagshipEntry,
  mergeFlagships,
} from "@/data/oemFlagships";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Mode = "oem" | "popular" | "custom";
interface TenantOverride {
  tracker_vehicle_mode: Mode;
  tracker_vehicle_year: number | null;
  tracker_vehicle_make: string | null;
  tracker_vehicle_model: string | null;
  tracker_vehicle_style: string | null;
  tracker_vehicle_specs: string | null;
}
const DEFAULT_TENANT_OVERRIDE: TenantOverride = {
  tracker_vehicle_mode: "oem",
  tracker_vehicle_year: null,
  tracker_vehicle_make: null,
  tracker_vehicle_model: null,
  tracker_vehicle_style: null,
  tracker_vehicle_specs: null,
};

type FlagshipMap = Record<string, FlagshipEntry>;

/**
 * Admin screen for the OEM → flagship-vehicle mapping that powers the
 * homepage Value Tracker card. Built-in defaults ship in
 * `src/data/oemFlagships.ts`; this page stores per-tenant overrides
 * (or net-new keys) on `site_config.tracker_oem_flagships`.
 */
const TrackerVehicleMapping = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [overrides, setOverrides] = useState<FlagshipMap>({});
  const [savedOverrides, setSavedOverrides] = useState<FlagshipMap>({});
  const [tenantOv, setTenantOv] = useState<TenantOverride>(DEFAULT_TENANT_OVERRIDE);
  const [savedTenantOv, setSavedTenantOv] = useState<TenantOverride>(DEFAULT_TENANT_OVERRIDE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("site_config")
        .select("tracker_oem_flagships, tracker_vehicle_mode, tracker_vehicle_year, tracker_vehicle_make, tracker_vehicle_model, tracker_vehicle_style, tracker_vehicle_specs")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      const raw = (data?.tracker_oem_flagships as unknown as FlagshipMap) || {};
      setOverrides(raw);
      setSavedOverrides(raw);
      const tov: TenantOverride = {
        tracker_vehicle_mode: ((data?.tracker_vehicle_mode as Mode) || "oem"),
        tracker_vehicle_year: data?.tracker_vehicle_year ?? null,
        tracker_vehicle_make: data?.tracker_vehicle_make ?? null,
        tracker_vehicle_model: data?.tracker_vehicle_model ?? null,
        tracker_vehicle_style: data?.tracker_vehicle_style ?? null,
        tracker_vehicle_specs: (data as any)?.tracker_vehicle_specs ?? null,
      };
      setTenantOv(tov);
      setSavedTenantOv(tov);
      setLoading(false);
    })();
  }, [dealershipId]);

  // Effective map = defaults + overrides; this is exactly what the
  // landing renders.
  const effective = useMemo(() => mergeFlagships(overrides), [overrides]);




  const updateEntry = (key: string, patch: Partial<FlagshipEntry>) => {
    setOverrides((prev) => {
      const base = prev[key] ?? effective[key] ?? DEFAULT_OEM_FLAGSHIPS.ford;
      return {
        ...prev,
        [key]: { ...base, ...patch } as FlagshipEntry,
      };
    });
  };

  const resetEntry = (key: string) => {
    setOverrides((prev) => {
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const removeKey = (key: string) => {
    // If it was a built-in default, we can't fully remove it from the
    // effective map — but admins should still be able to delete a
    // custom-added key entirely.
    if (DEFAULT_OEM_FLAGSHIPS[key]) {
      resetEntry(key);
      return;
    }
    setOverrides((prev) => {
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const [newKey, setNewKey] = useState("");
  const addKey = () => {
    const key = newKey.trim().toLowerCase();
    if (!key) return;
    if (effective[key]) {
      toast({
        title: "Key already exists",
        description: `"${key}" is already in the mapping — edit the row instead.`,
        variant: "destructive",
      });
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [key]: {
        year: "2022",
        make: "",
        model: "",
        style: "",
        specs: "",
      },
    }));
    setNewKey("");
  };

  const dirty =
    JSON.stringify(overrides) !== JSON.stringify(savedOverrides) ||
    JSON.stringify(tenantOv) !== JSON.stringify(savedTenantOv);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        tracker_oem_flagships: overrides as any,
        tracker_vehicle_mode: tenantOv.tracker_vehicle_mode,
        tracker_vehicle_year: tenantOv.tracker_vehicle_year,
        tracker_vehicle_make: tenantOv.tracker_vehicle_make,
        tracker_vehicle_model: tenantOv.tracker_vehicle_model,
        tracker_vehicle_style: tenantOv.tracker_vehicle_style,
        tracker_vehicle_specs: tenantOv.tracker_vehicle_specs,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("dealership_id", dealershipId);
    setSaving(false);
    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSavedOverrides(overrides);
    setSavedTenantOv(tenantOv);
    queryClient.invalidateQueries({ queryKey: ["site_config"] });
    toast({
      title: "Tracker vehicles saved",
      description: "Homepage Value Tracker will reflect changes on next load.",
    });
  };

  const discard = () => {
    setOverrides(savedOverrides);
    setTenantOv(savedTenantOv);
  };

  // Show all keys present in either defaults or overrides, sorted
  // alphabetically.
  const allKeys = useMemo(
    () =>
      Array.from(
        new Set([...Object.keys(DEFAULT_OEM_FLAGSHIPS), ...Object.keys(overrides)]),
      ).sort(),
    [overrides],
  );

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-8">Loading mapping…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-card-foreground">
            Tracker Vehicle Mapping
          </h3>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Pick the flagship vehicle shown in the homepage Value Tracker for
            each OEM brand. The dealer's display name is searched for these
            lowercase substrings (longest match wins) — e.g. "Harte Infiniti"
            matches <code className="text-xs px-1 rounded bg-muted">infiniti</code>.
            Edits override the built-in defaults; reset a row to restore the default.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty || saving}
            onClick={discard}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Discard
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={handleSave}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* ─────────── This dealership's tracker vehicle ─────────── */}
      <div className="rounded-lg border p-4 bg-card space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-card-foreground">
            This dealership's Tracker vehicle
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Force a specific vehicle for <span className="font-medium">{tenant?.display_name || "this dealership"}</span>{" "}
            regardless of the OEM mapping below.
          </p>
        </div>

        <RadioGroup
          value={tenantOv.tracker_vehicle_mode}
          onValueChange={(v) =>
            setTenantOv((p) => ({ ...p, tracker_vehicle_mode: v as Mode }))
          }
          className="grid sm:grid-cols-3 gap-2"
        >
          {[
            { v: "oem",     label: "Match by OEM",     desc: "Auto-pick from the mapping below using the dealership name." },
            { v: "popular", label: "Popular fallback", desc: "Show a single broadly-recognized vehicle (Toyota RAV4)." },
            { v: "custom",  label: "Pick my own",      desc: "Use the year / make / model entered below." },
          ].map((opt) => (
            <label
              key={opt.v}
              className={`flex gap-2 rounded-md border p-3 cursor-pointer text-sm ${
                tenantOv.tracker_vehicle_mode === opt.v
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <RadioGroupItem value={opt.v} className="mt-0.5" />
              <div>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
            </label>
          ))}
        </RadioGroup>

        {tenantOv.tracker_vehicle_mode === "custom" && (
          <div className="grid sm:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={tenantOv.tracker_vehicle_year ?? ""}
                onChange={(e) =>
                  setTenantOv((p) => ({
                    ...p,
                    tracker_vehicle_year: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="2022"
              />
            </div>
            <div>
              <Label className="text-xs">Make</Label>
              <Input
                value={tenantOv.tracker_vehicle_make ?? ""}
                onChange={(e) =>
                  setTenantOv((p) => ({ ...p, tracker_vehicle_make: e.target.value || null }))
                }
                placeholder="Ford"
              />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input
                value={tenantOv.tracker_vehicle_model ?? ""}
                onChange={(e) =>
                  setTenantOv((p) => ({ ...p, tracker_vehicle_model: e.target.value || null }))
                }
                placeholder="Explorer"
              />
            </div>
            <div>
              <Label className="text-xs">Trim / Style</Label>
              <Input
                value={tenantOv.tracker_vehicle_style ?? ""}
                onChange={(e) =>
                  setTenantOv((p) => ({ ...p, tracker_vehicle_style: e.target.value || null }))
                }
                placeholder="XLT"
              />
            </div>
            <div>
              <Label className="text-xs">Specs line</Label>
              <Input
                value={tenantOv.tracker_vehicle_specs ?? ""}
                onChange={(e) =>
                  setTenantOv((p) => ({ ...p, tracker_vehicle_specs: e.target.value || null }))
                }
                placeholder="4D SUV · 2.3L · 38k mi"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 p-3 rounded-lg border bg-muted/30">
        <div className="flex-1">
          <Label className="text-xs">Add brand key</Label>
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="e.g. rivian, polestar, lucid"
            onKeyDown={(e) => {
              if (e.key === "Enter") addKey();
            }}
          />
        </div>
        <Button size="sm" onClick={addKey} disabled={!newKey.trim()}>
          <Plus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Brand key</TableHead>
              <TableHead className="w-[80px]">Year</TableHead>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Trim / Style</TableHead>
              <TableHead>Specs line</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allKeys.map((key) => {
              const entry = effective[key];
              const isOverridden = Object.prototype.hasOwnProperty.call(
                overrides,
                key,
              );
              const isCustom = !DEFAULT_OEM_FLAGSHIPS[key];
              return (
                <TableRow key={key}>
                  <TableCell className="font-mono text-xs align-top pt-3">
                    <div className="flex flex-col gap-1">
                      <span>{key}</span>
                      <div className="flex gap-1 flex-wrap">
                        {isCustom && (
                          <Badge variant="secondary" className="text-[10px]">
                            Custom
                          </Badge>
                        )}
                        {isOverridden && !isCustom && (
                          <Badge variant="outline" className="text-[10px]">
                            Overridden
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={entry.year}
                      onChange={(e) => updateEntry(key, { year: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={entry.make}
                      onChange={(e) => updateEntry(key, { make: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={entry.model}
                      onChange={(e) => updateEntry(key, { model: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={entry.style}
                      onChange={(e) => updateEntry(key, { style: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={entry.specs}
                      onChange={(e) => updateEntry(key, { specs: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex justify-end gap-1">
                      {isOverridden && !isCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetEntry(key)}
                          title="Reset to default"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeKey(key)}
                          title="Remove custom key"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TrackerVehicleMapping;
