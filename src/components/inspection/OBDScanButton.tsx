import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import {
  Cpu,
  CheckCircle2,
  Smartphone,
  Power,
  Cable,
  Keyboard,
  Loader2,
  ScanLine,
} from "lucide-react";
import { InDevelopmentBadge } from "@/components/admin/InDevelopmentBadge";

interface OBDScanButtonProps {
  submissionId: string;
  submissionToken: string;
  vehicleStr: string;
  /** Optional button style variant. */
  variant?: "default" | "compact";
  /** Optional button label override. */
  label?: string;
}

/**
 * OBDScanButton — premium dialog that walks the inspector through plugging
 * in the OBDLink MX+ and handing off the scan URL to a phone via QR code.
 * Listens to Supabase Realtime on `vehicle_scans` and shows a success state
 * automatically when a scan is inserted for this submission.
 */
export default function OBDScanButton({
  submissionId,
  submissionToken,
  vehicleStr,
  variant = "default",
  label,
}: OBDScanButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"waiting" | "success">("waiting");

  // Build the scanner URL. Falls back gracefully if window is unavailable (SSR).
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const scanUrl = `${origin}/obd-scan/${submissionToken}`;

  // Realtime listener — only active while the modal is open
  useEffect(() => {
    if (!open || !submissionId) return;
    setStatus("waiting");
    const channel = (supabase as any)
      .channel(`vehicle_scans_btn:${submissionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vehicle_scans",
          filter: `submission_id=eq.${submissionId}`,
        },
        () => {
          setStatus("success");
          // Auto-close after 2 seconds
          setTimeout(() => {
            setOpen(false);
          }, 2000);
        },
      )
      .subscribe();
    return () => {
      try { (supabase as any).removeChannel(channel); } catch { /* noop */ }
    };
  }, [open, submissionId]);

  const buttonLabel = label ?? "Scan OBD-II";

  return (
    <>
      {/* Trigger button */}
      <Button
        onClick={() => setOpen(true)}
        size={variant === "compact" ? "sm" : "default"}
        className={
          variant === "compact"
            ? "rounded-xl h-9 text-xs font-semibold gap-1.5 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm"
            : "rounded-xl h-10 text-sm font-semibold gap-2 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm"
        }
      >
        <ScanLine className={variant === "compact" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        {buttonLabel}
      </Button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border border-border/60 rounded-2xl shadow-2xl">
          {/* ── Gradient header ── */}
          <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b border-border/40">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/15 border border-primary/20">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogHeader className="space-y-0">
                  <DialogTitle className="text-base font-black tracking-tight text-card-foreground flex items-center gap-2 flex-wrap">
                    OBD-II Diagnostic Scan
                    <InDevelopmentBadge
                      label="Beta"
                      reason="Requires an OBDLink CX or compatible BLE adapter. Currently in beta."
                      size="sm"
                    />
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                    {vehicleStr || "Capture live vehicle diagnostics"}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {status === "success" ? (
              /* ── Success state ── */
              <div className="py-6 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-2 border-emerald-500/40 mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-black text-card-foreground tracking-tight">
                  Scan Received
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Diagnostic data captured successfully. Updating results…
                </p>
              </div>
            ) : (
              <>
                {/* ── Instructions ── */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Before you scan
                  </p>
                  <ul className="space-y-2">
                    <InstructionRow
                      icon={Cable}
                      text="Plug the OBDLink MX+ into the vehicle's OBD-II port (usually under the dash)."
                    />
                    <InstructionRow
                      icon={Power}
                      text="Turn the ignition ON (engine running or in accessory mode)."
                    />
                    <InstructionRow
                      icon={Smartphone}
                      text="Scan the QR code below with your phone's camera or the Autocurb Scanner app."
                    />
                  </ul>
                </div>

                {/* ── QR code ── */}
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-white rounded-2xl border-2 border-border/60 shadow-sm">
                    <QRCodeSVG
                      value={scanUrl}
                      size={192}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center max-w-[260px] leading-snug">
                    Scan this code with the Autocurb Scanner app on your phone, or open the URL directly on an Android device with Chrome.
                  </p>
                  <code className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded-md truncate max-w-full">
                    {scanUrl}
                  </code>
                </div>

                {/* ── Waiting indicator ── */}
                <div className="flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-primary/30 bg-primary/5">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-[11px] font-semibold text-primary">
                    Waiting for scan to complete…
                  </span>
                </div>

                {/* ── Fallback ── */}
                <div className="pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground hover:text-card-foreground transition-colors mx-auto"
                  >
                    <Keyboard className="w-3 h-3" />
                    Manual entry instead
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InstructionRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[11px] leading-snug">
      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-muted/60 border border-border/60 shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
      </div>
      <span className="text-card-foreground/90 pt-0.5">{text}</span>
    </li>
  );
}
