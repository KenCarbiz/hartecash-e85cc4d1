import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Upload, Camera, ShieldCheck, Smartphone, Check, X, RefreshCw,
  FileText, Sparkles, Lock, Copy, Wifi, Clock, AlertCircle,
  ChevronRight, Loader2, MessageSquare, Link2, RadioTower, CheckCircle2,
  Eye, Image as ImageIcon, Sun, Crop, Scan,
} from "lucide-react";
import { PrimaryButton, SecondaryButton, SectionLabel, StatusPill } from "./PortalPageShell";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { useDocumentConfig, type DocumentConfig } from "@/hooks/useDocumentConfig";
import { usePortalIdentity } from "./PortalDataContext";
import { toast } from "sonner";

/* =========================================================================
   DocumentUploadHub — a single persistent cross-device upload center.
   Replaces per-document drawers with one synced session that spans
   desktop and mobile (QR / SMS handoff + live sync simulation).
   ========================================================================= */

export type HubDocStatus =
  | "Approved"
  | "Uploaded"
  | "Under Review"
  | "Needed"
  | "Rejected";

export type HubDoc = {
  name: string;
  status: HubDocStatus;
  date?: string;
  reason?: string;
  source?: "Desktop" | "iPhone" | "Android";
};

type Props = {
  open: boolean;
  onClose: () => void;
  docs: HubDoc[];
  focusDoc?: string | null;
};

const TONE: Record<HubDocStatus, "green" | "indigo" | "orange" | "gray" | "red"> = {
  Approved: "green",
  Uploaded: "indigo",
  "Under Review": "orange",
  Needed: "gray",
  Rejected: "red",
};

const ICONS: Record<HubDocStatus, JSX.Element> = {
  Approved: <CheckCircle2 className="w-3.5 h-3.5" />,
  Uploaded: <Check className="w-3.5 h-3.5" />,
  "Under Review": <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  Needed: <Clock className="w-3.5 h-3.5" />,
  Rejected: <AlertCircle className="w-3.5 h-3.5" />,
};

/* ---------- Mobile detection -------------------------------------------- */
const useIsMobile = () => {
  const [m, setM] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 768px)");
    const update = () => setM(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return m;
};

/* ---------- Real upload pipeline ---------------------------------------- */
/* Uploads a customer document to Supabase storage and fires the same
   mark-uploaded / notification / OCR hooks as EssentialUploads, so the
   hub's in-panel uploads behave identically to the standalone uploader.
   Storage layout: odometer → submission-photos (the AI scorer expects it
   there); everything else → customer-documents under a doc_id folder. */
const uploadCustomerDoc = async (
  doc: DocumentConfig,
  file: File,
  token: string,
  submissionId: string | null,
) => {
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
      context: { from: `DocumentUploadHub.${doc.doc_id}` },
    });
  } else {
    await supabase.rpc("mark_docs_uploaded", { _token: token } as never);
    safeInvoke("send-notification", {
      body: { trigger_key: "docs_uploaded", submission_id: submissionId },
      context: { from: `DocumentUploadHub.${doc.doc_id}` },
    });
  }

  // OCR auto-fill — best-effort, never blocks the upload. Tracked in
  // ocr_jobs via the token-gated RPC so the customer's other views show
  // live progress, mirroring EssentialUploads.
  if (doc.ocr_pipeline) {
    let jobId: string | null = null;
    try {
      const { data: jobIdRaw } = await supabase.rpc("ocr_jobs_upsert_for_token" as never, {
        p_token: token, p_doc_id: doc.doc_id, p_pipeline: doc.ocr_pipeline,
        p_storage_bucket: bucket, p_storage_path: path, p_status: "queued",
      } as never);
      jobId = (jobIdRaw as string | null) ?? null;

      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 300);

      if (jobId) {
        await supabase.rpc("ocr_jobs_upsert_for_token" as never, {
          p_token: token, p_doc_id: doc.doc_id, p_pipeline: doc.ocr_pipeline,
          p_storage_bucket: bucket, p_storage_path: path, p_status: "running", p_job_id: jobId,
        } as never);
      }

      if (signedData?.signedUrl) {
        const { error: fnErr } = await supabase.functions.invoke(doc.ocr_pipeline, {
          body: { imageUrl: signedData.signedUrl, submissionToken: token },
        });
        if (fnErr) throw fnErr;
      } else {
        throw new Error("Could not sign upload for OCR");
      }

      if (jobId) {
        await supabase.rpc("ocr_jobs_upsert_for_token" as never, {
          p_token: token, p_doc_id: doc.doc_id, p_pipeline: doc.ocr_pipeline,
          p_storage_bucket: bucket, p_storage_path: path, p_status: "completed", p_job_id: jobId,
        } as never);
      }
    } catch (ocrErr) {
      const msg = ocrErr instanceof Error ? ocrErr.message : "OCR failed";
      console.warn(`[DocumentUploadHub] OCR skipped (${doc.ocr_pipeline}):`, ocrErr);
      if (jobId) {
        await supabase.rpc("ocr_jobs_upsert_for_token" as never, {
          p_token: token, p_doc_id: doc.doc_id, p_pipeline: doc.ocr_pipeline,
          p_storage_bucket: bucket, p_storage_path: path, p_status: "failed", p_error: msg, p_job_id: jobId,
        } as never);
      }
    }
  }
};

/* ---------- Trust strip -------------------------------------------------- */
const TrustStrip = () => (
  <div className="flex items-center gap-3 text-[11px] text-[#53627A]">
    <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> SOC 2</span>
    <span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#16A34A]" /> Encrypted in transit</span>
    <span className="inline-flex items-center gap-1.5"><RadioTower className="w-3.5 h-3.5 text-[#4F46E5]" /> Synced</span>
  </div>
);

/* ---------- Continue on Phone panel ------------------------------------- */
const HandoffPanel = ({
  remaining,
  active,
  onActivate,
}: { remaining: HubDoc[]; active: boolean; onActivate: () => void }) => {
  /* Phone-handoff QR — points at /docs/:token, the real route
     mounted in App.tsx. Reads the submission token from the URL so
     the phone session loads the same customer's submission. */
  const { token } = useParams<{ token: string }>();
  const url = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "https://portal.moto.app";
    if (!token) return `${base}/`;
    return `${base}/docs/${token}`;
  }, [token]);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 min

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [active]);

  const mins = Math.floor(countdown / 60);
  const secs = String(countdown % 60).padStart(2, "0");

  const sendSms = () => {
    if (!phone.trim()) return;
    setSent(true);
    onActivate();
    setTimeout(() => setSent(false), 2400);
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    onActivate();
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E6EAF0] bg-gradient-to-br from-[#06194A] via-[#1E1B4B] to-[#4F46E5] text-white p-5">
      <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-white/70 font-semibold">
            <Smartphone className="w-3 h-3" /> Continue on phone
          </div>
          <div className="text-[17px] font-extrabold leading-tight mt-1.5">
            Upload the rest from your phone
          </div>
          <p className="text-[12.5px] text-white/75 mt-1 leading-relaxed">
            {remaining.length > 0
              ? `${remaining.length} document${remaining.length === 1 ? "" : "s"} remaining. Scan once — your phone picks up exactly where you left off.`
              : "All caught up. You can still use your phone if you need to replace anything."}
          </p>

          {remaining.length > 0 && (
            <ul className="mt-3 space-y-1">
              {remaining.slice(0, 3).map((d) => (
                <li key={d.name} className="flex items-center gap-2 text-[12px] text-white/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                  {d.name}
                </li>
              ))}
              {remaining.length > 3 && (
                <li className="text-[11px] text-white/55 pl-3.5">+ {remaining.length - 3} more</li>
              )}
            </ul>
          )}

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MessageSquare className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/10 border border-white/15 text-[12.5px] text-white placeholder:text-white/45 focus:outline-none focus:border-white/40"
                />
              </div>
              <button
                onClick={sendSms}
                className="px-3 py-2 rounded-lg bg-white text-[#06194A] text-[12px] font-bold hover:bg-white/90 transition"
              >
                {sent ? "Sent ✓" : "Text link"}
              </button>
            </div>
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 border border-white/15 text-[12px] text-white/90 hover:bg-white/15 transition"
            >
              <Link2 className="w-3.5 h-3.5" />
              {copied ? "Link copied" : "Copy secure link"}
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3 text-[10.5px] text-white/60">
            <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> 256-bit encrypted</span>
            {active && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {mins}:{secs} session
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-center gap-2">
          <div className="bg-white p-2 rounded-xl shadow-lg">
            <QRCodeSVG value={url} size={104} bgColor="#ffffff" fgColor="#06194A" level="M" />
          </div>
          <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Scan to continue</div>
          {active && (
            <div className="inline-flex items-center gap-1 text-[10px] text-[#86efac]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#86efac] opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]" />
              </span>
              Session active
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- Mobile camera-first card ------------------------------------ */
const MobileUploadCard = ({
  doc,
  busy,
  onFile,
}: { doc: HubDoc; busy: boolean; onFile: (file: File) => void }) => {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };

  const done =
    doc.status === "Approved" || doc.status === "Uploaded" || doc.status === "Under Review";

  return (
    <div className="rounded-2xl border border-[#E6EAF0] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
          done ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#EEF0FF] text-[#4F46E5]"
        }`}>
          {done ? <Check className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-[#06194A]">{doc.name}</div>
          <div className="text-[11.5px] text-[#53627A] mt-0.5">
            {done ? "Received — we'll review it shortly" : "Tap below to capture"}
          </div>
        </div>
        <StatusPill tone={TONE[doc.status]}>{ICONS[doc.status]} {doc.status}</StatusPill>
      </div>

      <AnimatePresence mode="wait">
        {busy ? (
          <motion.div
            key="ana"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 rounded-xl bg-[#EEF0FF] border border-[#C7D2FE] px-3 py-2.5"
          >
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#4F46E5]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] text-[#53627A]">
              <span className="inline-flex items-center gap-1"><Sun className="w-3 h-3" /> Light</span>
              <span className="inline-flex items-center gap-1"><Scan className="w-3 h-3" /> Focus</span>
              <span className="inline-flex items-center gap-1"><Crop className="w-3 h-3" /> Frame</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Auth</span>
            </div>
          </motion.div>
        ) : !done ? (
          <motion.div
            key="ctrl"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-3 grid grid-cols-2 gap-2"
          >
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
            <input ref={libRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pick} />
            <button
              onClick={() => camRef.current?.click()}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#06194A] text-white text-[12.5px] font-bold hover:bg-[#1E2B6B] transition"
            >
              <Camera className="w-4 h-4" /> Take Photo
            </button>
            <button
              onClick={() => libRef.current?.click()}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#F4F6FA] text-[#06194A] text-[12.5px] font-semibold hover:bg-[#EEF0FF] transition"
            >
              <ImageIcon className="w-4 h-4" /> Library
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/* ---------- Desktop document row ---------------------------------------- */
const DesktopDocRow = ({
  doc,
  highlight,
  busy,
  onFile,
  onPreview,
}: {
  doc: HubDoc;
  highlight: boolean;
  busy: boolean;
  onFile: (file: File) => void;
  onPreview: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const needs = doc.status === "Needed" || doc.status === "Rejected";
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };
  return (
    <motion.div
      className={`relative rounded-2xl border bg-white p-3.5 transition-colors ${
        highlight ? "border-[#4F46E5] ring-2 ring-[#4F46E5]/15" : "border-[#E6EAF0]"
      }`}
    >
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={pick} />
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
          doc.status === "Approved" || doc.status === "Uploaded"
            ? "bg-[#DCFCE7] text-[#16A34A]"
            : doc.status === "Rejected"
            ? "bg-[#FEE2E2] text-[#DC2626]"
            : doc.status === "Under Review"
            ? "bg-[#FEF3C7] text-[#B45309]"
            : "bg-[#F4F6FA] text-[#53627A]"
        }`}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13.5px] font-bold text-[#06194A] truncate">{doc.name}</span>
            <StatusPill tone={TONE[doc.status]}>{ICONS[doc.status]} {doc.status}</StatusPill>
          </div>
          <div className="text-[11px] text-[#53627A] mt-0.5 flex items-center gap-1.5">
            {doc.date ? (
              <>
                <Clock className="w-3 h-3" />
                {doc.status === "Under Review" ? "AI reviewing" : "Uploaded"} {doc.date}
                {doc.source && (
                  <span className="inline-flex items-center gap-1 text-[#4F46E5] font-semibold">
                    · <Smartphone className="w-3 h-3" /> {doc.source}
                  </span>
                )}
              </>
            ) : (
              "Not yet uploaded"
            )}
          </div>
          {doc.status === "Rejected" && doc.reason && (
            <div className="mt-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1.5 text-[11.5px] text-[#B91C1C] inline-flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {doc.reason}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2.5">
            {needs ? (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#06194A] hover:bg-[#1E2B6B] text-white text-[11.5px] font-bold transition disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {busy ? "Uploading…" : doc.status === "Rejected" ? "Resubmit" : "Upload"}
              </button>
            ) : (
              <>
                <button
                  onClick={onPreview}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F4F6FA] hover:bg-[#EEF0FF] text-[#06194A] text-[11.5px] font-semibold transition"
                >
                  <Eye className="w-3 h-3" /> Preview
                </button>
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#E6EAF0] hover:bg-[#F4F6FA] text-[#53627A] text-[11.5px] font-semibold transition disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {busy ? "Uploading…" : "Replace"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ---------- Main hub panel ---------------------------------------------- */
export const DocumentUploadHub = ({ open, onClose, docs: initialDocs, focusDoc }: Props) => {
  const isMobile = useIsMobile();
  const { token, submissionId, dealershipId, loanStatus } = usePortalIdentity();
  const { customerAllDocs } = useDocumentConfig(dealershipId || "default", loanStatus);
  const [handoffActive, setHandoffActive] = useState(false);
  const [docs, setDocs] = useState<HubDoc[]>(initialDocs);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => { setDocs(initialDocs); }, [initialDocs]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Match each visible doc (keyed by its label) to the dealer's doc
  // catalog so uploads land in the right bucket / doc_id folder and fire
  // the same OCR + notification hooks as the standalone uploader.
  const catalogByName = useMemo(() => {
    const m = new Map<string, DocumentConfig>();
    for (const d of customerAllDocs) m.set(d.label, d);
    return m;
  }, [customerAllDocs]);

  const completed = docs.filter((d) => d.status === "Approved" || d.status === "Uploaded").length;
  const total = docs.length;
  const pct = total ? (completed / total) * 100 : 0;
  const remaining = docs.filter((d) => d.status === "Needed" || d.status === "Rejected");
  const eta = Math.max(1, remaining.length * 2);

  const handleUpload = async (name: string, file: File) => {
    if (!token) {
      toast.error("Upload unavailable here", {
        description: "Open the portal from your secure link to upload documents.",
      });
      return;
    }
    const doc = catalogByName.get(name);
    if (!doc) {
      toast.error("Can't upload this item online", {
        description: "Please contact your dealer to submit this document.",
      });
      return;
    }
    setBusy((b) => ({ ...b, [name]: true }));
    try {
      await uploadCustomerDoc(doc, file, token, submissionId);
      setDocs((p) =>
        p.map((d) =>
          d.name === name
            ? { ...d, status: "Under Review", date: "Just now", source: isMobile ? "iPhone" : "Desktop" }
            : d,
        ),
      );
      toast.success("Uploaded", { description: `${doc.label} received — we'll review it shortly.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again or use the phone handoff.";
      toast.error("Upload failed", { description: msg });
    } finally {
      setBusy((b) => ({ ...b, [name]: false }));
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ov"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[#06194A]/45 backdrop-blur-sm"
          />
          <motion.aside
            key="pn"
            role="dialog" aria-modal="true" aria-label="Document Upload Hub"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 w-full lg:max-w-[640px] bg-[#F7F8FB] shadow-2xl flex flex-col lg:rounded-l-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 lg:px-6 pt-5 pb-4 bg-white border-b border-[#E6EAF0]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[#4F46E5] font-bold">
                    <Sparkles className="w-3 h-3" /> Upload Hub
                  </div>
                  <h3 className="text-[18px] font-extrabold text-[#06194A] leading-tight mt-1">
                    Document Collection
                  </h3>
                  <p className="text-[12px] text-[#53627A] mt-0.5">
                    One session — synced live across all your devices.
                  </p>
                </div>
                <button
                  aria-label="Close"
                  onClick={onClose}
                  className="shrink-0 w-9 h-9 rounded-lg hover:bg-[#F4F6FA] text-[#53627A] grid place-items-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress + trust */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[12px]">
                  <div className="font-bold text-[#06194A]">
                    {completed} of {total} completed
                  </div>
                  <div className="text-[#53627A] inline-flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> ~{eta} min remaining
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#F4F6FA] overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <TrustStrip />
                  {handoffActive && (
                    <motion.span
                      initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full"
                    >
                      <Wifi className="w-3 h-3" /> Mobile session live
                    </motion.span>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-5 space-y-5">
              {/* MOBILE-FIRST PATH */}
              {isMobile ? (
                <>
                  <div className="rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-white border border-[#C7D2FE] p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#4F46E5] uppercase tracking-wider">
                      <Camera className="w-3.5 h-3.5" /> Camera-first
                    </div>
                    <div className="text-[14px] font-extrabold text-[#06194A] mt-1">
                      Capture each document below
                    </div>
                    <p className="text-[12px] text-[#53627A] mt-1">
                      We'll auto-check lighting, focus, and framing as you go. The desktop view updates in real time.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {docs.map((d) => (
                      <MobileUploadCard
                        key={d.name}
                        doc={d}
                        busy={!!busy[d.name]}
                        onFile={(file) => handleUpload(d.name, file)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* DESKTOP: Handoff first (this is the centerpiece) */}
                  <HandoffPanel
                    remaining={remaining}
                    active={handoffActive}
                    onActivate={() => setHandoffActive(true)}
                  />

                  {/* Checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <SectionLabel>All documents</SectionLabel>
                      <span className="text-[11px] text-[#53627A]">{remaining.length} remaining</span>
                    </div>
                    <div className="space-y-2.5">
                      {docs.map((d) => (
                        <DesktopDocRow
                          key={d.name}
                          doc={d}
                          highlight={focusDoc === d.name}
                          busy={!!busy[d.name]}
                          onFile={(file) => handleUpload(d.name, file)}
                          onPreview={() => {}}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Direct upload hint — each row's Upload button opens a
                      file picker from this computer. */}
                  <div className="rounded-2xl border-2 border-dashed border-[#C7D2FE] bg-white p-5 text-center">
                    <Upload className="w-7 h-7 mx-auto text-[#4F46E5]" />
                    <div className="text-[13px] font-bold text-[#06194A] mt-2">Upload from this computer</div>
                    <div className="text-[11px] text-[#53627A] mt-1">
                      Use the Upload button on each document above, or scan the code to continue on your phone.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#E6EAF0] bg-white px-5 lg:px-6 py-3.5 flex items-center gap-2">
              <div className="flex-1 text-[11px] text-[#53627A] inline-flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#16A34A]" />
                Encrypted & stored only with your dealer team.
              </div>
              <SecondaryButton onClick={onClose} className="px-4 py-2 text-[12px]">Close</SecondaryButton>
              {remaining.length === 0 && (
                <PrimaryButton onClick={onClose} className="px-4 py-2 text-[12px]">
                  <Check className="w-3.5 h-3.5" /> Done
                </PrimaryButton>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default DocumentUploadHub;
