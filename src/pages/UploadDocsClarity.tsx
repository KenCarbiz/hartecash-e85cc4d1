import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Upload, X, FileText, CreditCard, ClipboardList, ScrollText, Plus, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Clarity-tier document upload page — Apple-minimal companion to
 * the rest of the Clarity customer-journey pages. Mounted by
 * UploadDocs.tsx as a top-level dispatch when landing_template ===
 * "clarity".
 *
 * Scope: bold "Send us your documents" hero, five doc-type tiles
 * (DL front + back, registration, title front + back), file
 * picker per tile (camera capture on mobile via the capture
 * attribute), submit, done state. Same Supabase storage path
 * conventions and parse-title-vin trigger as the legacy page so
 * dealer alerts + OCR run unchanged.
 *
 * Not yet ported: DocumentCameraCapture overlay, MobileQRBanner,
 * VIN-mismatch reconciliation flow. Those can layer in once the
 * scaffold is verified.
 */

const DOC_TYPES = [
  { key: "drivers_license_front", label: "Driver's License — Front", icon: CreditCard, ocr: true },
  { key: "drivers_license_back", label: "Driver's License — Back", icon: CreditCard },
  { key: "registration", label: "Registration", icon: ClipboardList },
  { key: "title_front", label: "Title — Front", icon: ScrollText, ocr: true },
  { key: "title_back", label: "Title — Back", icon: ScrollText },
];

interface SubmissionInfo {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  state: string | null;
  vin: string | null;
}

type DocFile = { file: File; docType: string; preview: string };

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const UploadDocsClarity = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const isMobile = useIsMobile();

  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<DocFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [activeDocType, setActiveDocType] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Invalid link.");
        setLoading(false);
        return;
      }
      const { data, error: rpcErr } = await supabase
        .rpc("get_submission_by_token", { _token: token })
        .maybeSingle();
      if (cancelled) return;
      if (rpcErr || !data) {
        setError("Submission not found.");
        setLoading(false);
        return;
      }
      setSubmission(data as unknown as SubmissionInfo);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleTileClick = (docType: string) => {
    setActiveDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files;
    if (!incoming || !activeDocType) return;
    const added: DocFile[] = [];
    Array.from(incoming).forEach((f) => {
      if (f.size > MAX_FILE_SIZE) {
        setError(`"${f.name}" exceeds 10MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        added.push({ file: f, docType: activeDocType, preview: ev.target?.result as string });
        if (added.length === Array.from(incoming).filter((x) => x.size <= MAX_FILE_SIZE).length) {
          setFiles((prev) => [...prev, ...added]);
        }
      };
      reader.readAsDataURL(f);
    });
    setError("");
    setActiveDocType("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleUpload = async () => {
    if (!submission || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const entry of files) {
        const ext = entry.file.name.split(".").pop();
        const path = `${token}/${entry.docType}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, entry.file, { contentType: entry.file.type });
        if (upErr) throw upErr;

        // OCR trigger — same as legacy. parse-title-vin reads the
        // newly uploaded image and writes back parsed fields.
        if (entry.docType === "title_front" || entry.docType === "drivers_license_front") {
          safeInvoke("parse-title-vin", {
            body: { submission_id: submission.id, token, doc_type: entry.docType, doc_path: path },
            context: { from: "UploadDocsClarity.upload", doc_type: entry.docType },
          });
        }
      }

      // Mark docs uploaded + dealer notification.
      if (token) {
        await supabase
          .from("submissions")
          .update({ docs_uploaded: true } as any)
          .eq("token", token);
      }
      if (submission?.id) {
        safeInvoke("send-notification", {
          body: { trigger_key: "documents_uploaded", submission_id: submission.id },
          context: { from: "UploadDocsClarity.submit" },
        });
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" aria-hidden="true" />
      </div>
    );
  }

  if (error && !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-zinc-900 px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Submission Not Found</h1>
          <p className="text-sm text-zinc-500">{error}</p>
          <Link to="/my-submission" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Look up your submission
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <Header config={config} />
        <main className="max-w-[640px] mx-auto px-5 md:px-8 py-12 md:py-16 space-y-8 text-center">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mx-auto"
            aria-hidden="true"
          >
            <CheckCircle className="w-8 h-8 text-emerald-500" strokeWidth={2} />
          </motion.div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Documents received
          </p>
          <h1 className="font-sans text-[36px] md:text-[48px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
            Thanks — we've got them.
          </h1>
          <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
            We'll review and reach out if anything's missing. You can also add more from your submission page.
          </p>
          <Button
            onClick={() => navigate(`/my-submission/${token}`)}
            className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
          >
            View my submission <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        </main>
      </div>
    );
  }

  if (!submission) return null;

  const vehicleStr = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");
  const filesByDocType = (docType: string) => files.filter((f) => f.docType === docType);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <Header config={config} />
      <main className="max-w-[840px] mx-auto px-5 md:px-8 py-10 md:py-14 space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3 text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Documents</p>
          <h1 className="font-sans text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
            Send us your documents
          </h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Snap your driver's license, registration, and title for {vehicleStr ? `your ${vehicleStr}` : "your vehicle"}. We'll handle the rest.
          </p>
        </motion.section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Mobile QR — desktop-only nudge to scan documents from
            the customer's phone where they can use the rear camera
            to capture title / DL more cleanly than a webcam. */}
        {!isMobile && token && (
          <section
            aria-label="Continue on your phone"
            className="rounded-3xl border border-zinc-200 bg-zinc-50/40 p-6 flex items-center gap-6"
          >
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-200">
              <QRCodeSVG value={`${window.location.origin}/docs/${token}`} size={120} level="H" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                Easier on your phone
              </p>
              <p className="text-base font-semibold tracking-tight text-zinc-900 mb-2">
                Scan to continue on mobile
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                Snap your title and ID with your rear camera and they'll sync back here automatically.
              </p>
              <a
                href={`${window.location.origin}/docs/${token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:text-zinc-600 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                Or tap to open on this device
              </a>
            </div>
          </section>
        )}

        <section aria-label="Document tiles" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DOC_TYPES.map((doc) => {
            const Icon = doc.icon;
            const tileFiles = filesByDocType(doc.key);
            const filled = tileFiles.length > 0;
            return (
              <button
                key={doc.key}
                type="button"
                onClick={() => handleTileClick(doc.key)}
                className={`relative rounded-2xl border-2 p-5 text-left transition-all ${
                  filled
                    ? "border-zinc-900 bg-zinc-50/40"
                    : "border-zinc-200 hover:border-zinc-400 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      filled ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}
                    aria-hidden="true"
                  >
                    {filled ? <CheckCircle className="w-4 h-4" strokeWidth={2.5} /> : <Icon className="w-4 h-4" />}
                  </span>
                  <p className="text-sm font-semibold tracking-tight text-zinc-900">{doc.label}</p>
                </div>
                {tileFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tileFiles.map((entry, i) => {
                      const idx = files.indexOf(entry);
                      return (
                        <div key={`${doc.key}-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden border border-zinc-200">
                          <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                          <span
                            role="button"
                            aria-label="Remove file"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-zinc-900/80 text-white flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </div>
                      );
                    })}
                    <span
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-400"
                      aria-hidden="true"
                    >
                      <Plus className="w-4 h-4" />
                    </span>
                  </div>
                )}
                {!filled && (
                  <p className="text-xs text-zinc-500">Tap to upload or take a photo</p>
                )}
              </button>
            );
          })}
        </section>

        <div>
          <Button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="w-full md:w-auto md:px-10 h-14 rounded-full text-base font-semibold bg-zinc-900 hover:bg-zinc-800 text-white"
            style={
              config.landing_cta_color
                ? { background: config.landing_cta_color, color: config.landing_cta_text_color || "#ffffff" }
                : undefined
            }
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                Submit documents
              </>
            )}
          </Button>
          <p className="text-[11px] text-zinc-500 mt-3">
            We'll OCR your driver's license and title automatically. Anything missing — we'll text you.
          </p>
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

const Header = ({ config }: { config: any }) => (
  <header className="border-b border-zinc-200 bg-white">
    <div className="max-w-[840px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3 min-w-0">
        <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
        {config.logo_url ? (
          <img src={config.logo_url} alt={config.dealership_name} className="h-7 w-auto object-contain" />
        ) : (
          <span className="text-sm font-semibold tracking-tight truncate text-zinc-900">
            {config.dealership_name}
          </span>
        )}
      </Link>
      {config.phone && (
        <a
          href={`tel:${config.phone}`}
          className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          {config.phone}
        </a>
      )}
    </div>
  </header>
);

export default UploadDocsClarity;
