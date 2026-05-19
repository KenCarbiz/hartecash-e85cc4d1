import { useEffect, useRef, useState } from "react";
import { Camera, ScrollText, CreditCard, Check, Loader2, ArrowRight, FileText, Smartphone, Sparkles, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useDocumentConfig, type DocumentConfig } from "@/hooks/useDocumentConfig";
import { toast } from "sonner";

interface EssentialUploadsProps {
  token: string;
  submissionId: string;
  /**
   * Customer's loan status from submissions.loan_status. Lets the
   * hook resolve 'conditional' docs (payoff, lease buyout) into
   * required/optional appropriately.
   */
  loanStatus?: string | null;
  /**
   * Customer's dealership for per-tenant doc list.
   */
  dealershipId?: string;
}

type SlotState = "idle" | "uploading" | "done";

// Map doc_id → icon for the customer-visible uploads. Falls back to
// FileText for any new doc the dealer adds.
const ICON_BY_DOC: Record<string, typeof Camera> = {
  drivers_license_front: CreditCard,
  drivers_license_back:  CreditCard,
  title_front:           ScrollText,
  title_back:            ScrollText,
  registration:          FileText,
  payoff_verification:   FileText,
  lease_buyout:          FileText,
  odometer:              Camera,
};

/**
 * Customer-portal upload panel. Renders one tile per dealer-
 * configured customer doc (useDocumentConfig drives the list, no
 * hardcoding). Each tile is tap-to-capture from this device, with
 * a "Switch to phone" QR code that opens /docs/<token> on a phone
 * for tenants that prefer the rear camera for title/DL framing.
 *
 * Customer can return to the portal any time — finished slots
 * stay marked 'done' because the on-mount effect lists the bucket
 * and pre-flips matching slots, mirroring how VehiclePhotos works
 * for the photo flow.
 */
const EssentialUploads = ({ token, submissionId, loanStatus, dealershipId }: EssentialUploadsProps) => {
  const { customerAllDocs } = useDocumentConfig(dealershipId || "default", loanStatus);
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // On mount / when the catalog resolves, list customer-documents
  // storage to surface anything already uploaded so the customer
  // doesn't double-upload after returning to the portal.
  useEffect(() => {
    if (!token || customerAllDocs.length === 0) return;
    let cancelled = false;
    (async () => {
      const seeds: Record<string, SlotState> = {};
      for (const d of customerAllDocs) {
        const bucket = d.doc_id === "odometer" ? "submission-photos" : "customer-documents";
        const prefix = bucket === "submission-photos" ? token : `${token}/${d.doc_id}`;
        const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 5 });
        if (cancelled) return;
        const hasFile = (data || []).some((f) => {
          if (f.name === ".emptyFolderPlaceholder") return false;
          if (bucket === "submission-photos") return f.name.startsWith(`${d.doc_id}-`);
          return true;
        });
        if (hasFile) seeds[d.doc_id] = "done";
      }
      if (!cancelled) setSlotStates((prev) => ({ ...seeds, ...prev }));
    })();
    return () => { cancelled = true; };
  }, [token, customerAllDocs]);

  const triggerForSlot = (docId: string) => {
    setActiveSlot(docId);
    setTimeout(() => inputRefs.current[docId]?.click(), 50);
  };

  const handleFile = async (doc: DocumentConfig, file: File | null) => {
    if (!file) return;
    setSlotStates((prev) => ({ ...prev, [doc.doc_id]: "uploading" }));

    try {
      // Odometer is the one customer-visible "doc" that lives in
      // submission-photos because the AI scoring pipeline already
      // expects to find it there. Everything else lands in
      // customer-documents under doc_id-scoped folders so the dealer
      // file slide-out can list each doc category cleanly.
      const isPhoto = doc.doc_id === "odometer";
      const bucket: "submission-photos" | "customer-documents" =
        isPhoto ? "submission-photos" : "customer-documents";
      const ext = file.name.split(".").pop() || "jpg";
      const stamp = Date.now();
      const path = isPhoto
        ? `${token}/${doc.doc_id}-${stamp}.${ext}`
        : `${token}/${doc.doc_id}/${stamp}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadErr) throw uploadErr;

      if (isPhoto) {
        await supabase.rpc("mark_photos_uploaded", { _token: token } as never);
        safeInvoke("send-notification", {
          body: { trigger_key: "photos_uploaded", submission_id: submissionId },
          context: { from: `EssentialUploads.${doc.doc_id}` },
        });
      } else {
        await supabase.rpc("mark_docs_uploaded", { _token: token } as never);
        safeInvoke("send-notification", {
          body: { trigger_key: "docs_uploaded", submission_id: submissionId },
          context: { from: `EssentialUploads.${doc.doc_id}` },
        });
      }

      // OCR auto-fill — fired here when the customer uploaded directly.
      // Mirrors StaffFileUpload.tsx so dealer + customer paths share
      // the same hook into parse-drivers-license / parse-title-vin.
      if (doc.ocr_pipeline) {
        try {
          const { data: signedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 300);
          if (signedData?.signedUrl) {
            await supabase.functions.invoke(doc.ocr_pipeline, {
              body: { imageUrl: signedData.signedUrl, submissionToken: token },
            });
          }
        } catch (ocrErr) {
          console.warn(`OCR auto-fill skipped (${doc.ocr_pipeline}):`, ocrErr);
        }
      }

      setSlotStates((prev) => ({ ...prev, [doc.doc_id]: "done" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Try again or use the full upload page.";
      setSlotStates((prev) => ({ ...prev, [doc.doc_id]: "idle" }));
      toast.error("Upload failed", { description: msg });
    } finally {
      setActiveSlot(null);
    }
  };

  if (customerAllDocs.length === 0) return null;

  const allDone = customerAllDocs
    .filter((d) => d.role === "required")
    .every((d) => slotStates[d.doc_id] === "done");
  const phoneUrl = `${window.location.origin}/docs/${token}`;

  return (
    <div className="rounded-2xl border-2 border-success/30 bg-gradient-to-br from-success/5 via-card to-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-success">
            Lock it in
          </p>
          <h3 className="font-bold text-card-foreground text-base mt-0.5">
            Quick uploads to confirm
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Snap each from your phone — takes under a minute.
          </p>
        </div>
        {allDone && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-full shrink-0">
            <Check className="w-3.5 h-3.5" />
            All set
          </div>
        )}
      </div>

      <div className={`grid gap-2.5 ${customerAllDocs.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3"}`}>
        {customerAllDocs.map((doc) => {
          const state = slotStates[doc.doc_id] || "idle";
          const Icon = ICON_BY_DOC[doc.doc_id] || FileText;
          const isActive = activeSlot === doc.doc_id;
          const isRequired = doc.role === "required";
          return (
            <button
              key={doc.doc_id}
              onClick={() => triggerForSlot(doc.doc_id)}
              disabled={state === "uploading" || state === "done"}
              className={`relative flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 text-center transition-all ${
                state === "done"
                  ? "border-success/40 bg-success/10 cursor-default"
                  : state === "uploading"
                  ? "border-primary/30 bg-primary/5"
                  : "border-dashed border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <input
                ref={(el) => { inputRefs.current[doc.doc_id] = el; }}
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(doc, e.target.files?.[0] || null)}
              />
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  state === "done" ? "bg-success text-white" : "bg-primary/10 text-primary"
                }`}
              >
                {state === "uploading" && isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : state === "done" ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-card-foreground flex items-center justify-center gap-1">
                  {doc.label}
                  {!isRequired && state !== "done" && (
                    <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">opt</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {state === "done" ? "Uploaded" : doc.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          {showQr ? "Hide phone QR" : "Switch to phone"}
        </button>
        <Link
          to={`/upload/${token}`}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          Want to add more? Upload the full set
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {showQr && (
        <div className="mt-4 flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border">
          <QRCodeSVG value={phoneUrl} size={160} level="H" />
          <p className="text-[11px] text-muted-foreground text-center max-w-xs">
            Scan with your phone's camera to continue uploading there. Anything you submit syncs back to this page automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default EssentialUploads;
