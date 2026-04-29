import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_ROLES, SECTION_GROUPS, ALL_SECTIONS,
  defaultAllowedForRole, type RoleKey,
} from "@/lib/rolePermissionDefaults";
import { ROLE_LABELS } from "@/lib/adminConstants";

// Matrix-only label overrides. Appraiser isn't in the app_role enum
// (it's the additive is_appraiser flag), so it's not in ROLE_LABELS.
// Add it here so the column header reads "Appraiser" not "appraiser".
const MATRIX_ROLE_LABELS: Record<string, string> = {
  ...ROLE_LABELS,
  appraiser: "Appraiser",
  user: "User",
};

interface OverrideRow {
  role: string;
  section_key: string;
  allowed: boolean;
}

const cellKey = (role: string, section: string) => `${role}::${section}`;

/**
 * Phase 1 of the gradual permissions roll-out. Tenant-wide matrix
 * (no per-store overrides yet) — every sidebar section listed as a
 * row, every role as a column, checkbox at the intersection.
 *
 * Reads tenant_role_section_permissions for any tenant-wide overrides
 * (location_id IS NULL), falling back to defaultAllowedForRole() for
 * cells that haven't been customised. Saves only changed cells via
 * upsert; deletes cells that match the built-in default so the
 * override table stays minimal.
 *
 * Phase 2 (follow-up): per-store override tab + a "global for the
 * group" / "per-store" toggle so multi-rooftop dealers can split or
 * unify their access policy.
 */
const RolePermissionsMatrix = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();

  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Pending in-memory edits (not yet persisted). Map cell-key → bool.
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tenant_role_section_permissions")
        .select("role, section_key, allowed")
        .eq("dealership_id", tenant.dealership_id)
        .is("location_id", null);
      if (cancelled) return;
      const m = new Map<string, boolean>();
      ((data as OverrideRow[]) || []).forEach((r) => {
        m.set(cellKey(r.role, r.section_key), r.allowed);
      });
      setOverrides(m);
      setPending(new Map());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  // Effective cell value: pending edit > saved override > built-in default.
  const cellValue = (role: string, section: string): boolean => {
    const k = cellKey(role, section);
    if (pending.has(k)) return pending.get(k)!;
    if (overrides.has(k)) return overrides.get(k)!;
    return defaultAllowedForRole(role, section);
  };

  // Whether this cell currently differs from the built-in default.
  const isOverridden = (role: string, section: string): boolean => {
    const k = cellKey(role, section);
    if (pending.has(k)) return pending.get(k) !== defaultAllowedForRole(role, section);
    return overrides.has(k);
  };

  const dirtyCount = pending.size;

  const toggleCell = (role: string, section: string) => {
    const k = cellKey(role, section);
    const next = !cellValue(role, section);
    setPending((prev) => {
      const m = new Map(prev);
      const def = defaultAllowedForRole(role, section);
      const saved = overrides.has(k) ? overrides.get(k) : null;
      // If the new value matches the saved override, remove the
      // pending edit (it's a no-op).
      if (saved !== null && saved === next) {
        m.delete(k);
        return m;
      }
      // If the new value matches the built-in default AND there's no
      // saved override, also remove (also a no-op).
      if (saved === null && next === def) {
        m.delete(k);
        return m;
      }
      m.set(k, next);
      return m;
    });
  };

  const resetCellToDefault = (role: string, section: string) => {
    const k = cellKey(role, section);
    const def = defaultAllowedForRole(role, section);
    setPending((prev) => {
      const m = new Map(prev);
      // If there's a saved override, queue a delete (encoded as
      // "set to default" — save() will detect this and delete the row).
      if (overrides.has(k)) {
        m.set(k, def);
      } else {
        m.delete(k);
      }
      return m;
    });
  };

  const discardChanges = () => setPending(new Map());

  const save = async () => {
    if (pending.size === 0) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id ?? null;
    const upserts: Array<{ dealership_id: string; role: string; section_key: string; allowed: boolean; updated_by: string | null; updated_at: string; location_id: null }> = [];
    const deletes: Array<{ role: string; section_key: string }> = [];

    pending.forEach((v, k) => {
      const [role, section] = k.split("::");
      const def = defaultAllowedForRole(role, section);
      if (v === def) {
        // Matches default → drop any saved override.
        deletes.push({ role, section_key: section });
      } else {
        upserts.push({
          dealership_id: tenant.dealership_id,
          location_id: null,
          role,
          section_key: section,
          allowed: v,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        });
      }
    });

    let firstError: { message: string } | null = null;
    if (upserts.length > 0) {
      const { error } = await supabase
        .from("tenant_role_section_permissions")
        .upsert(upserts as any);
      if (error) firstError = error;
    }
    for (const d of deletes) {
      const { error } = await supabase
        .from("tenant_role_section_permissions")
        .delete()
        .eq("dealership_id", tenant.dealership_id)
        .is("location_id", null)
        .eq("role", d.role)
        .eq("section_key", d.section_key);
      if (!firstError && error) firstError = error;
    }

    setSaving(false);
    if (firstError) {
      toast({ title: "Couldn't save", description: firstError.message, variant: "destructive" });
      return;
    }

    // Bake pending into overrides map; deletes drop from the map.
    setOverrides((prev) => {
      const m = new Map(prev);
      pending.forEach((v, k) => {
        const [role, section] = k.split("::");
        const def = defaultAllowedForRole(role, section);
        if (v === def) {
          m.delete(k);
        } else {
          m.set(k, v);
        }
      });
      return m;
    });
    setPending(new Map());
    toast({
      title: "Permissions saved",
      description: `${upserts.length + deletes.length} change${upserts.length + deletes.length === 1 ? "" : "s"} applied.`,
    });
  };

  const overrideCount = useMemo(() => {
    let total = 0;
    overrides.forEach(() => total++);
    pending.forEach((v, k) => {
      const [role, section] = k.split("::");
      const wasOverridden = overrides.has(k);
      const willBeOverridden = v !== defaultAllowedForRole(role, section);
      if (!wasOverridden && willBeOverridden) total++;
      if (wasOverridden && !willBeOverridden) total--;
    });
    return total;
  }, [overrides, pending]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Role permissions matrix
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Override which sidebar sections each role can open. Cells start at the built-in default and turn into a tenant override the moment you flip them. The page-level access guard (admin) and the route-level checks still apply on top — this matrix only adjusts visibility.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            <Badge variant="outline" className="text-[10px] mr-1.5">{overrideCount}</Badge>
            overrides active for this tenant ·{" "}
            <Badge variant="outline" className="text-[10px] mr-1.5">{dirtyCount}</Badge>
            unsaved
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirtyCount > 0 && (
            <Button variant="outline" size="sm" onClick={discardChanges} disabled={saving}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={saving || dirtyCount === 0}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Save {dirtyCount > 0 ? `(${dirtyCount})` : ""}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 z-10 min-w-[200px]">
                  Section
                </th>
                {DEFAULT_ROLES.map((role) => (
                  <th key={role} className="px-2 py-2 font-semibold whitespace-nowrap text-center">
                    {MATRIX_ROLE_LABELS[role] || role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTION_GROUPS.map((group) => (
                <>
                  <tr key={`g-${group.label}`} className="bg-muted/30">
                    <td colSpan={DEFAULT_ROLES.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      {group.label}
                    </td>
                  </tr>
                  {group.sections.map((section) => (
                    <tr key={section.key} className="border-t border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-1.5 font-medium sticky left-0 bg-card z-10">
                        {section.label}
                        <span className="block text-[10px] text-muted-foreground font-mono font-normal">{section.key}</span>
                      </td>
                      {DEFAULT_ROLES.map((role) => {
                        const allowed = cellValue(role, section.key);
                        const overridden = isOverridden(role, section.key);
                        return (
                          <td key={role} className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => toggleCell(role, section.key)}
                              onDoubleClick={() => resetCellToDefault(role, section.key)}
                              title={`${MATRIX_ROLE_LABELS[role] || role} can ${allowed ? "see" : "NOT see"} ${section.label}.${overridden ? " Overridden — double-click to reset to default." : ""}`}
                              className={`relative w-8 h-8 rounded-md border transition-colors ${
                                allowed
                                  ? "bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25"
                                  : "bg-slate-200/60 border-slate-300 hover:bg-slate-200/80 dark:bg-slate-800 dark:border-slate-700"
                              } ${overridden ? "ring-2 ring-amber-400/60" : ""}`}
                            >
                              {allowed ? (
                                <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓</span>
                              ) : (
                                <span className="text-slate-400">·</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-1">
        <p>· Click a cell to toggle. Amber ring = the cell is overriding the built-in default.</p>
        <p>· Double-click an overridden cell to reset it to the built-in default.</p>
        <p>· <strong>Appraiser is additive</strong> — its row is OR'd with the user's primary-role row when their <span className="font-mono">is_appraiser</span> flag is on. Other roles are mutually exclusive.</p>
        <p>· Per-store overrides ship in Phase 2 — today every change applies group-wide.</p>
      </div>
    </div>
  );
};

export default RolePermissionsMatrix;
