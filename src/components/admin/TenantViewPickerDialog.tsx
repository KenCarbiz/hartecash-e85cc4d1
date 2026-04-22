import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Shield, Loader2 } from "lucide-react";

interface TenantViewPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dealership this dialog is for — pre-selected before opening. */
  tenant: {
    dealership_id: string;
    display_name: string;
  } | null;
}

/**
 * Super Admin "View as Tenant" confirmation dialog. Requires a written
 * reason before the view session can begin. On submit, creates the
 * tenant_view_log row via TenantContext.setViewAsTenant() and navigates
 * to /admin where the super admin sees the target tenant's data with
 * the TenantViewBanner locked at the top of the page.
 */
export default function TenantViewPickerDialog({
  open,
  onOpenChange,
  tenant,
}: TenantViewPickerDialogProps) {
  const { setViewAsTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!tenant) return;
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      toast({
        title: "Reason required",
        description: "Please enter at least 10 characters describing why you need to view this tenant.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const ok = await setViewAsTenant({
      dealership_id: tenant.dealership_id,
      display_name: tenant.display_name,
      reason: trimmed,
    });
    setSubmitting(false);
    if (!ok) {
      toast({
        title: "Failed to start tenant view",
        description: "You must be a platform admin to use this feature.",
        variant: "destructive",
      });
      return;
    }
    onOpenChange(false);
    setReason("");
    toast({
      title: `Now viewing ${tenant.display_name}`,
      description: "Exit the session any time from the red banner at the top.",
    });
    // Navigate to /admin — the TenantProvider will now return the
    // overridden tenant, so every query on the admin dashboard runs
    // against the target's data.
    navigate("/admin");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setReason(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <Eye className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-black">
                View as Tenant
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                You will see {tenant?.display_name || "this tenant"}'s admin with their data
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* What this does — reassuring copy */}
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed space-y-2">
            <p className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground">Your session stays yours.</strong> You remain
                authenticated as yourself — only the tenant context is swapped. Every action you take
                still shows your email in the activity log.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground">A red banner stays on screen</strong> the entire
                time so you never forget which tenant you're viewing. Click Exit to return to Super Admin.
              </span>
            </p>
          </div>

          {/* Reason — required */}
          <div className="space-y-1.5">
            <Label htmlFor="view-reason" className="text-xs font-semibold">
              Reason for this view <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="view-reason"
              placeholder="e.g. Investigating support ticket #1234 — dealer reports empty Appraiser Queue"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="text-sm"
              disabled={submitting}
            />
            <p className="text-[10px] text-muted-foreground">
              Logged to the compliance audit trail. Minimum 10 characters.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || reason.trim().length < 10}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-1.5" />
                Start Viewing
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
