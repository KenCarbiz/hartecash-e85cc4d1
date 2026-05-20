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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("site_config")
        .select("tracker_oem_flagships")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      const raw = (data?.tracker_oem_flagships as FlagshipMap) || {};
      setOverrides(raw);
      setSavedOverrides(raw);
      setLoading(false);
    })();
  }, [dealershipId]);

  // Effective map = defaults + overrides; this is exactly what the
  // landing renders.
  const effective = useMemo(() => mergeFlagships(overrides), [overrides]);

  const dirty = JSON.stringify(overrides) !== JSON.stringify(savedOverrides);

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

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({
        tracker_oem_flagships: overrides as any,
        updated_at: new Date().toISOString(),
      })
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
    queryClient.invalidateQueries({ queryKey: ["site_config"] });
    toast({
      title: "Tracker vehicles saved",
      description: "Homepage Value Tracker will reflect changes on next load.",
    });
  };

  const discard = () => setOverrides(savedOverrides);

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

      {/* Add new key */}
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
