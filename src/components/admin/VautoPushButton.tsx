// VautoPushButton
// ----------------------------------------------------------------------------
// Embeddable "Push to vAuto" control. Drop into SubmissionDetailSheet or
// AppraisalTool. Disabled until the appraisal is finalized. If the submission
// has already been pushed, shows a badge with the vAuto vehicle id + timestamp
// instead of the button.
// ----------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, CheckCircle2, Truck } from "lucide-react";

interface VautoPushButtonProps {
  submissionId: string;
  appraisalFinalized: boolean;
  alreadyPushed: boolean;
  /** Optional — if omitted the component re-fetches timestamp/id itself */
  pushedAt?: string | null;
  vautoVehicleId?: string | null;
  /** Called after a successful push so the parent can refresh its cached row. */
  onPushed?: () => void;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
}

const VautoPushButton = ({
  submissionId,
  appraisalFinalized,
  alreadyPushed,
  pushedAt,
  vautoVehicleId,
  onPushed,
  size = "sm",
  variant = "outline",
}: VautoPushButtonProps) => {
  const { toast } = useToast();
  const [pushing, setPushing] = useState(false);
  const [localPushed, setLocalPushed] = useState(alreadyPushed);
  const [localPushedAt, setLocalPushedAt] = useState<string | null>(pushedAt ?? null);
  const [localVautoId, setLocalVautoId] = useState<string | null>(vautoVehicleId ?? null);

  useEffect(() => {
    setLocalPushed(alreadyPushed);
    setLocalPushedAt(pushedAt ?? null);
    setLocalVautoId(vautoVehicleId ?? null);
  }, [alreadyPushed, pushedAt, vautoVehicleId]);

  const handlePush = async () => {
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-to-vauto", {
        body: { submission_id: submissionId, pushed_by: "manual" },
      });

      if (error) throw error;
      const result = data as any;

      if (result?.status === "success") {
        setLocalPushed(true);
        setLocalPushedAt(new Date().toISOString());
        setLocalVautoId(result.vauto_vehicle_id || null);
        toast({
          title: "Pushed to vAuto",
          description: result.vauto_vehicle_id
            ? `Vehicle ID: ${result.vauto_vehicle_id}`
            : "Successfully pushed.",
        });
        onPushed?.();
      } else if (result?.status === "pending") {
        toast({
          title: "Staged for vAuto",
          description:
            result.reason === "credentials_missing"
              ? "Saved to push log — waiting for Cox API credentials."
              : "Saved to push log in sandbox mode.",
        });
      } else if (result?.status === "skipped") {
        toast({
          title: "vAuto not enabled",
          description: result.reason || "Enable vAuto integration in admin settings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Push failed",
          description: result?.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Push failed",
        description: e?.message || String(e),
        variant: "destructive",
      });
    }
    setPushing(false);
  };

  if (localPushed) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1.5 py-1 px-2.5"
      >
        <CheckCircle2 className="w-3 h-3" />
        <span className="font-semibold">Pushed to vAuto</span>
        {localVautoId && <span className="font-mono text-[10px] opacity-80">· {localVautoId}</span>}
        {localPushedAt && (
          <span className="text-[10px] opacity-70">
            · {new Date(localPushedAt).toLocaleDateString()}
          </span>
        )}
      </Badge>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handlePush}
      disabled={!appraisalFinalized || pushing}
      title={!appraisalFinalized ? "Finalize the appraisal before pushing to vAuto" : undefined}
      className="gap-1.5"
    >
      {pushing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Truck className="w-3.5 h-3.5" />
      )}
      Push to vAuto
    </Button>
  );
};

export default VautoPushButton;
