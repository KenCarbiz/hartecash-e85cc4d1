// Platform-admin-only kill switch toggle for the refreshed admin UI.
// See frontend-redesign/CLAUDE_CODE_BRIEF.md §6D.
//
// Renders inside System Settings, but only when:
//   1. The viewer is a platform admin (gated upstream via canManageAccess
//      on the system-settings section), AND
//   2. They are currently viewing-as another tenant
//      (TenantContext.isViewingAsTenant === true).
//
// Toggling the switch upserts site_config.ui_refresh_enabled for the
// target tenant and writes a single audit row to activity_log with
// action = "ui_refresh_toggled" + the old/new boolean values. The row
// uses submission_id = null, which the migration in
// supabase/migrations/20260425120000_ui_refresh_flag.sql made nullable.

import { useState, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { Loader2 } from "lucide-react";

interface PlatformUIRefreshToggleProps {
  /** Audit label used as activity_log.performed_by. Mirrors the
   *  pattern in useAdminDashboard's other audit writes. */
  auditLabel: string;
}

const PlatformUIRefreshToggle = ({ auditLabel }: PlatformUIRefreshToggleProps) => {
  const { tenant, isViewingAsTenant } = useTenant();
  const { config } = useSiteConfig();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentEnabled = useMemo(
    () => Boolean((config as any).ui_refresh_enabled),
    [config],
  );
  const [localEnabled, setLocalEnabled] = useState<boolean>(currentEnabled);
  const [saving, setSaving] = useState(false);

  // Hide entirely outside of a tenant view-as session. The
  // system-settings section is already canManageAccess-gated upstream;
  // this is defense-in-depth.
  if (!isViewingAsTenant) return null;

  const dirty = localEnabled !== currentEnabled;

  const handleSave = async () => {
    setSaving(true);
    try {
      const oldValue = currentEnabled;
      const newValue = localEnabled;

      // Upsert the flag — keyed on dealership_id. site_config rows are
      // 1:1 with dealerships, so onConflict is the right idempotency.
      const { error: upsertErr } = await (supabase as any)
        .from("site_config")
        .upsert(
          {
            dealership_id: tenant.dealership_id,
            ui_refresh_enabled: newValue,
          },
          { onConflict: "dealership_id" },
        );
      if (upsertErr) {
        toast({
          title: "Save failed",
          description: upsertErr.message,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // Audit trail. submission_id is NULL for tenant-scoped events
      // (see the supabase migration that made the column nullable).
      const { error: auditErr } = await supabase.from("activity_log").insert({
        submission_id: null,
        action: "ui_refresh_toggled",
        old_value: String(oldValue),
        new_value: String(newValue),
        performed_by: auditLabel || "unknown",
      });
      if (auditErr) {
        // Audit failure shouldn't block the user from seeing the change
        // take effect, but log it so we know.
        console.error("[PlatformUIRefreshToggle] audit insert failed:", auditErr);
      }

      // Invalidate the site_config cache so every consumer (sidebar,
      // section renderer, default-home effect) sees the new value.
      await queryClient.invalidateQueries({ queryKey: ["site_config"] });

      toast({
        title: newValue ? "Refresh enabled" : "Refresh disabled",
        description: `${tenant.display_name} now uses the ${newValue ? "refreshed" : "legacy"} UI.`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">UI Refresh Program</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Toggles the consolidated 5-group sidebar, Today home, refreshed
          lead table, appraiser queue, and front-desk appointments view
          for{" "}
          <span className="font-semibold text-foreground">
            {tenant.display_name}
          </span>
          . Default off — staff see the existing UI until you flip this on.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <Switch
          checked={localEnabled}
          onCheckedChange={setLocalEnabled}
          disabled={saving}
          aria-label="Enable refreshed UI"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">
            Enable refreshed UI for {tenant.display_name}
          </span>
          <span className="block text-xs text-muted-foreground">
            When on, this dealer's staff see the new sidebar, Today page,
            lead table, appraiser queue, and appointments layouts. When off,
            they see the existing UI. The change rolls out immediately on
            their next page load.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          Currently{" "}
          <span className="font-semibold text-foreground">
            {currentEnabled ? "ON" : "OFF"}
          </span>
          {dirty && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">
              · pending change
            </span>
          )}
        </p>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </section>
  );
};

export default PlatformUIRefreshToggle;
