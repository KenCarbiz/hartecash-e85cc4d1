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
interface DealerLocation { id: string; name: string }

const RolePermissionsMatrix = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();

  // Scope of edits:
  //   "tenant"       — tenant-wide rows (location_id IS NULL).
  //   "<location_id>" — per-store override.
  // Platform admin on the default tenant edits PLATFORM DEFAULTS in
  // tenant scope; that's surfaced as a different banner so they
  // don't confuse it with a regular dealer's settings.
  const [scope, setScope] = useState<string>("tenant");
  const [locations, setLocations] = useState<DealerLocation[]>([]);

  // This-scope rows (tenant-wide OR per-store, depending on scope).
  // The cells the admin is currently editing.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  // Tenant-wide rows — used as the baseline when the admin is in
  // per-store scope so the matrix shows what the store would inherit
  // from the tenant if it didn't override.
  const [tenantBaseline, setTenantBaseline] = useState<Map<string, boolean>>(new Map());
  // Platform-default rows — used as the baseline when the admin is
  // in tenant scope on a regular dealer. Falls through to the FE
  // builtin map when no platform default exists.
  const [platformBaseline, setPlatformBaseline] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Pending in-memory edits (not yet persisted). Map cell-key → bool.
  const [pending, setPending] = useState<Map<string, boolean>>(new Map());

  const isPlatformDefault = tenant.dealership_id === "default";
  const scopeLocationId = scope === "tenant" ? null : scope;

  // Load locations once so the scope dropdown can offer per-store
  // overrides for multi-rooftop dealers.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("dealership_locations")
        .select("id, name")
        .eq("dealership_id", tenant.dealership_id)
        .order("name", { ascending: true });
      if (!cancelled) setLocations((data || []) as DealerLocation[]);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // 1. This-scope override rows — the cells the admin is editing.
      let q = supabase
        .from("tenant_role_section_permissions")
        .select("role, section_key, allowed")
        .eq("dealership_id", tenant.dealership_id);
      q = scopeLocationId === null ? q.is("location_id", null) : q.eq("location_id", scopeLocationId);
      const scopeReq = q;

      // 2. Tenant-wide baseline (only matters when scope is per-store).
      const tenantReq = scopeLocationId !== null
        ? supabase
            .from("tenant_role_section_permissions")
            .select("role, section_key, allowed")
            .eq("dealership_id", tenant.dealership_id)
            .is("location_id", null)
        : Promise.resolve({ data: [] as OverrideRow[] });

      // 3. Platform default baseline (skip when we ARE the platform).
      const platformReq = !isPlatformDefault
        ? supabase
            .from("tenant_role_section_permissions")
            .select("role, section_key, allowed")
            .eq("dealership_id", "default")
            .is("location_id", null)
        : Promise.resolve({ data: [] as OverrideRow[] });

      const [{ data }, tenantRes, platformRes] = await Promise.all([scopeReq, tenantReq, platformReq]);
      if (cancelled) return;

      const m = new Map<string, boolean>();
      ((data as OverrideRow[]) || []).forEach((r) => m.set(cellKey(r.role, r.section_key), r.allowed));
      setOverrides(m);

      const tm = new Map<string, boolean>();
      ((tenantRes.data as OverrideRow[]) || []).forEach((r) => tm.set(cellKey(r.role, r.section_key), r.allowed));
      setTenantBaseline(tm);

      const pm = new Map<string, boolean>();
      ((platformRes.data as OverrideRow[]) || []).forEach((r) => pm.set(cellKey(r.role, r.section_key), r.allowed));
      setPlatformBaseline(pm);

      setPending(new Map());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenant.dealership_id, scopeLocationId, isPlatformDefault]);

  // Cascade-aware baseline — what the cell would resolve to if THIS
  // scope didn't override. Drives the "is this cell overriding
  // anything?" check + the matches-default cleanup on save.
  //   - per-store scope:  tenant override > platform default > builtin
  //   - tenant scope:     platform default > builtin
  //   - platform scope:   builtin
  const baselineFor = (role: string, section: string): boolean => {
    const k = cellKey(role, section);
    if (scopeLocationId !== null && tenantBaseline.has(k)) return tenantBaseline.get(k)!;
    if (!isPlatformDefault && platformBaseline.has(k)) return platformBaseline.get(k)!;
    return defaultAllowedForRole(role, section);
  };

  // Effective cell value: pending edit > this-scope override > baseline cascade.
  const cellValue = (role: string, section: string): boolean => {
    const k = cellKey(role, section);
    if (pending.has(k)) return pending.get(k)!;
    if (overrides.has(k)) return overrides.get(k)!;
    return baselineFor(role, section);
  };

  // Whether this cell currently differs from the cascade baseline.
  const isOverridden = (role: string, section: string): boolean => {
    const k = cellKey(role, section);
    if (pending.has(k)) return pending.get(k) !== baselineFor(role, section);
    return overrides.has(k);
  };

  const dirtyCount = pending.size;

  const toggleCell = (role: string, section: string) => {
    const k = cellKey(role, section);
    const next = !cellValue(role, section);
    setPending((prev) => {
      const m = new Map(prev);
      const def = baselineFor(role, section);
      const saved = overrides.has(k) ? overrides.get(k) : null;
      // If the new value matches the saved override, remove the
      // pending edit (it's a no-op).
      if (saved !== null && saved === next) {
        m.delete(k);
        return m;
      }
      // If the new value matches the cascade baseline AND there's no
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
    const def = baselineFor(role, section);
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
    const upserts: Array<{ dealership_id: string; role: string; section_key: string; allowed: boolean; updated_by: string | null; updated_at: string; location_id: string | null }> = [];
    const deletes: Array<{ role: string; section_key: string }> = [];

    pending.forEach((v, k) => {
      const [role, section] = k.split("::");
      const def = baselineFor(role, section);
      if (v === def) {
        // Matches the cascade baseline → drop any saved override at THIS scope.
        deletes.push({ role, section_key: section });
      } else {
        upserts.push({
          dealership_id: tenant.dealership_id,
          location_id: scopeLocationId,
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
      let q = supabase
        .from("tenant_role_section_permissions")
        .delete()
        .eq("dealership_id", tenant.dealership_id)
        .eq("role", d.role)
        .eq("section_key", d.section_key);
      q = scopeLocationId === null ? q.is("location_id", null) : q.eq("location_id", scopeLocationId);
      const { error } = await q;
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
        const def = baselineFor(role, section);
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
      const willBeOverridden = v !== baselineFor(role, section);
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
      {isPlatformDefault && (
        <div className="rounded-lg border border-purple-500/40 bg-purple-500/5 px-3 py-2.5 text-xs text-purple-700 dark:text-purple-400">
          <strong className="font-bold">Platform defaults — super admin view.</strong> Changes here become the seed for every new dealer onboarded. Existing dealers won't be affected unless they re-seed from defaults.
        </div>
      )}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {isPlatformDefault ? "Platform default permissions" : "Role permissions matrix"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            {isPlatformDefault
              ? "Set the default per-role section visibility every new dealer starts with. Each tenant can override these afterwards in their own Staff & Permissions page."
              : "Override which sidebar sections each role can open. Cells resolve in order: per-store > tenant > platform default > built-in. The matrix only adjusts visibility — page-level admin guards still apply."}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            <Badge variant="outline" className="text-[10px] mr-1.5">{overrideCount}</Badge>
            overrides at this scope ·{" "}
            <Badge variant="outline" className="text-[10px] mr-1.5">{dirtyCount}</Badge>
            unsaved
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Scope selector — only renders for multi-rooftop dealers.
              Platform admin view stays tenant-scoped (the "default"
              dealer doesn't have locations). */}
          {!isPlatformDefault && locations.length > 1 && (
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={dirtyCount > 0}
              className="h-9 px-2 text-xs rounded-md border border-border bg-background outline-none focus:border-primary/40"
              title={dirtyCount > 0 ? "Save or discard pending edits before changing scope" : "Switch between tenant-wide and per-store overrides"}
            >
              <option value="tenant">Whole tenant (group default)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>Per-store: {l.name}</option>
              ))}
            </select>
          )}
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
