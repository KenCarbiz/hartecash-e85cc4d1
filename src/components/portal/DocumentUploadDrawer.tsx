import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Upload, Camera, ShieldCheck, Smartphone, Check, X, RefreshCw,
  Image as ImageIcon, FileText, Sparkles, Sun, Crop, Scan, Lock,
  Copy, Wifi, Clock, AlertCircle, ChevronRight, Loader2,
} from "lucide-react";
import { SlideOver } from "./SlideOver";
import { PrimaryButton, SecondaryButton, SectionLabel } from "./PortalPageShell";

/* ---------- Document type metadata --------------------------------- */

export type DocKind =
  | "Driver's License"
  | "Title"
  | "Registration"
  | "Insurance Card"
  | "Odometer Photo"
  | "Payoff Statement"
  | string;

type DocMeta = {
  helper: string;
  tips: string[];
  captureLabel: string;
  facing: "front" | "back" | "both";
  aspect: "id" | "letter" | "wide" | "square";
};

const DOC_META: Record<string, DocMeta> = {
  "Driver's License": {
    helper: "Capture all four corners clearly. Glare-free, no fingers covering.",
    tips: ["Lay flat on a dark surface", "Avoid flash glare on the photo", "All four corners visible"],
    captureLabel: "Capture Front",
    facing: "both",
    aspect: "id",
  },
  "Title": {
    helper: "Photograph the full title document — front and back if signed.",
    tips: ["Use natural daylight", "Place on a flat dark surface", "Include all signatures and stamps"],
    captureLabel: "Capture Front",
    facing: "both",
    aspect: "letter",
  },
  "Registration": {
    helper: "Make sure the expiration date and VIN are legible.",
    tips: ["Avoid shadows", "Keep document flat", "Capture the full page"],
    captureLabel: "Capture Document",
    facing: "front",
    aspect: "letter",
  },
  "Insurance Card": {
    helper: "Both sides if your policy info is on the back.",
    tips: ["Policy number visible", "Effective dates legible", "No glare from plastic"],
    captureLabel: "Capture Card",
    facing: "both",
    aspect: "id",
  },
  "Odometer Photo": {
    helper: "Engine on, dashboard visible, numbers in focus.",
    tips: ["Wipe the cluster clean", "Hold steady, tap to focus", "No motion blur"],
    captureLabel: "Capture Odometer",
    facing: "front",
    aspect: "wide",
  },
  "Payoff Statement": {
    helper: "Most recent statement from your lender. PDF preferred.",
    tips: ["Include account number", "Show payoff amount", "Statement dated within 10 days"],
    captureLabel: "Capture Document",
    facing: "front",
    aspect: "letter",
  },
};

const fallbackMeta = (name: string): DocMeta => ({
  helper: "Take a clear photo or upload an existing file.",
  tips: ["Good lighting", "Document is flat", "All edges visible"],
  captureLabel: `Capture ${name}`,
  facing: "front",
  aspect: "letter",
});

/* ---------- Mobile handoff card ------------------------------------ */

const HandoffCard = ({ docName }: { docName: string }) => {
  /* Build a deep link that would re-open the mobile capture flow at the
     correct document. The host is a placeholder for the live portal URL. */
  const session = useMemo(
    () => Math.random().toString(36).slice(2, 10).toUpperCase(),
    [docName]
  );
  const url = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "https://portal.moto.app";
    const slug = encodeURIComponent(docName);
    return `${base}/m/upload/${slug}?s=${session}`;
  }, [docName, session]);

  const [secondsLeft, setSecondsLeft] = useState(10 * 60);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSecondsLeft(10 * 60);
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [docName]);

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#E0E7FF] bg-gradient-to-br from-[#F5F3FF] via-white to-[#EEF0FF] p-4">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#7C3AED]/10 blur-2xl pointer-events-none" />

      <div className="flex items-start gap-4">
        <div className="relative shrink-0 rounded-2xl bg-white p-2 shadow-[0_8px_24px_-12px_rgba(79,70,229,0.4)] ring-1 ring-[#E0E7FF]">
          <QRCodeSVG
            value={url}
            size={104}
            level="M"
            bgColor="#FFFFFF"
            fgColor="#06194A"
            includeMargin={false}
          />
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-7 h-7 rounded-lg bg-white grid place-items-center shadow ring-1 ring-[#E0E7FF]">
              <Smartphone className="w-3.5 h-3.5 text-[#4F46E5]" />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-[#4F46E5]">
            <Sparkles className="w-3 h-3" /> Continue on your phone
          </div>
          <div className="text-[13px] font-bold text-[#06194A] mt-1 leading-snug">
            Scan to open a secure mobile capture session.
          </div>
          <div className="text-[11px] text-[#53627A] mt-1 leading-snug">
            No login required. Opens directly to {docName}.
          </div>

          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0F7A3E] bg-[#E8F8EE] px-1.5 py-0.5 rounded-md">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-[#16A34A] opacity-60 animate-ping" />
                <span className="relative rounded-full w-1.5 h-1.5 bg-[#16A34A]" />
              </span>
              Session active
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#4F46E5] bg-[#EEF0FF] px-1.5 py-0.5 rounded-md tabular-nums">
              <Clock className="w-3 h-3" /> Expires in {mm}:{ss}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={copy}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#4F46E5] bg-white border border-[#E0E7FF] hover:border-[#C7D2FE] rounded-lg py-2 transition"
      >
        {copied
          ? <><Check className="w-3 h-3" /> Link copied</>
          : <><Copy className="w-3 h-3" /> Copy secure link</>}
      </button>
    </div>
  );
};

/* ---------- Framing guide preview ---------------------------------- */

const ASPECT_RATIO: Record<DocMeta["aspect"], string> = {
  id: "aspect-[1.586/1]",     // ID-1 card
  letter: "aspect-[8.5/11]",
  wide: "aspect-[16/9]",
  square: "aspect-square",
};

const FramePreview = ({ meta }: { meta: DocMeta }) => (
  <div className={`relative w-full ${ASPECT_RATIO[meta.aspect]} max-h-[180px] mx-auto rounded-xl bg-gradient-to-br from-[#0F172A] to-[#1E1B4B] overflow-hidden`}>
    {/* corner marks */}
    {["top-2 left-2 border-t-2 border-l-2", "top-2 right-2 border-t-2 border-r-2",
      "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"
    ].map((c) => (
      <div key={c} className={`absolute ${c} w-5 h-5 border-[#A78BFA] rounded-sm`} />
    ))}
    {/* scanning beam */}
    <motion.div
      initial={{ y: "0%" }}
      animate={{ y: ["0%", "100%", "0%"] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-[#A78BFA] to-transparent"
    />
    <div className="absolute inset-0 grid place-items-center">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/70 font-semibold flex items-center gap-1.5">
        <Scan className="w-3 h-3" /> Align inside frame
      </div>
    </div>
  </div>
);

/* ---------- Main drawer -------------------------------------------- */

type Step = "choose" | "uploading" | "analyzing" | "ready";
type AIChecks = { lighting: boolean; focus: boolean; framing: boolean; glare: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  docName: DocKind;
  onSubmit?: () => void;
};

export const DocumentUploadDrawer = ({ open, onClose, docName, onSubmit }: Props) => {
  const meta = DOC_META[docName] ?? fallbackMeta(docName);
  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [checks, setChecks] = useState<AIChecks>({ lighting: false, focus: false, framing: false, glare: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!open) {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      setStep("choose");
      setFileName(null);
      setProgress(0);
      setChecks({ lighting: false, focus: false, framing: false, glare: false });
    }
  }, [open]);

  const beginUpload = (name: string) => {
    setFileName(name);
    setStep("uploading");
    setProgress(0);
    const tick = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { window.clearInterval(tick); return 100; }
        return Math.min(100, p + 8 + Math.random() * 12);
      });
    }, 120);
    timers.current.push(tick as unknown as number);

    timers.current.push(window.setTimeout(() => setStep("analyzing"), 1400));
    timers.current.push(window.setTimeout(() => setChecks((c) => ({ ...c, lighting: true })), 1700));
    timers.current.push(window.setTimeout(() => setChecks((c) => ({ ...c, focus: true })),    2100));
    timers.current.push(window.setTimeout(() => setChecks((c) => ({ ...c, framing: true })),  2500));
    timers.current.push(window.setTimeout(() => setChecks((c) => ({ ...c, glare: true })),    2900));
    timers.current.push(window.setTimeout(() => setStep("ready"), 3100));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) beginUpload(f.name);
  };

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setStep("choose");
    setFileName(null);
    setProgress(0);
    setChecks({ lighting: false, focus: false, framing: false, glare: false });
  };

  const submit = () => {
    onSubmit?.();
    onClose();
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Upload ${docName}`}
      subtitle={meta.helper}
      width="lg"
      footer={
        step === "ready" ? (
          <div className="flex gap-2">
            <SecondaryButton onClick={reset} className="flex-1">
              <RefreshCw className="w-4 h-4" /> Retake
            </SecondaryButton>
            <PrimaryButton onClick={submit} className="flex-1">
              <Check className="w-4 h-4" /> Submit Document
            </PrimaryButton>
          </div>
        ) : step === "choose" ? (
          <div className="text-[11px] text-[#53627A] inline-flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#16A34A] mt-0.5 shrink-0" />
            Documents are encrypted in transit and at rest. Only your dealer team can view them.
          </div>
        ) : null
      }
    >
      {/* Hidden inputs */}
      <input ref={inputRef} type="file" className="hidden"
             accept=".pdf,image/jpeg,image/png,image/heic,image/heif" onChange={onFile} />
      <input ref={cameraRef} type="file" className="hidden"
             accept="image/*" capture="environment" onChange={onFile} />

      <AnimatePresence mode="wait">
        {step === "choose" && (
          <motion.div
            key="choose"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
            className="space-y-4"
          >
            {/* Mobile handoff — the headline feature */}
            <HandoffCard docName={docName} />

            <div className="relative flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] font-semibold text-[#8893A8]">
              <div className="h-px bg-[#EEF0F4] flex-1" />
              or upload from this device
              <div className="h-px bg-[#EEF0F4] flex-1" />
            </div>

            {/* Drop / picker */}
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#C7D2FE] bg-[#FAFBFE] hover:bg-[#EEF0FF] rounded-2xl p-6 text-center transition group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm mx-auto grid place-items-center mb-2 group-hover:scale-105 transition">
                <Upload className="w-5 h-5 text-[#4F46E5]" />
              </div>
              <div className="text-[13px] font-semibold text-[#06194A]">Drop a file or click to browse</div>
              <div className="text-[11px] text-[#53627A] mt-1">PDF, JPG, PNG, HEIC · up to 25MB</div>
            </button>

            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full inline-flex items-center justify-between gap-3 rounded-2xl border border-[#E6EAF0] bg-white hover:border-[#C7D2FE] hover:bg-[#F7F8FB] px-4 py-3 transition"
            >
              <span className="inline-flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
                  <Camera className="w-4 h-4" />
                </span>
                <span className="text-left">
                  <span className="block text-[13px] font-semibold text-[#06194A]">Use this device's camera</span>
                  <span className="block text-[11px] text-[#53627A]">{meta.captureLabel}</span>
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-[#8893A8]" />
            </button>

            {/* Framing preview + tips */}
            <div className="rounded-2xl border border-[#EEF0F4] bg-white p-4">
              <SectionLabel>AI Capture Guidance</SectionLabel>
              <div className="mt-3"><FramePreview meta={meta} /></div>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                {meta.tips.map((tip, i) => (
                  <li key={tip} className="flex items-start gap-1.5 text-[#06194A]">
                    <span className="w-4 h-4 rounded-md bg-[#E8F8EE] text-[#0F7A3E] grid place-items-center mt-0.5 shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] text-[#53627A]">
              <span className="inline-flex items-center gap-1 justify-center bg-[#F7F8FB] rounded-lg py-1.5 font-semibold">
                <ShieldCheck className="w-3 h-3 text-[#16A34A]" /> SOC 2
              </span>
              <span className="inline-flex items-center gap-1 justify-center bg-[#F7F8FB] rounded-lg py-1.5 font-semibold">
                <Lock className="w-3 h-3 text-[#16A34A]" /> Encrypted
              </span>
              <span className="inline-flex items-center gap-1 justify-center bg-[#F7F8FB] rounded-lg py-1.5 font-semibold">
                <Wifi className="w-3 h-3 text-[#4F46E5]" /> Auto-sync
              </span>
            </div>
          </motion.div>
        )}

        {(step === "uploading" || step === "analyzing") && (
          <motion.div
            key="up"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-[#EEF0F4] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center shrink-0">
                  {step === "uploading"
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Sparkles className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#06194A] truncate">{fileName ?? "Captured image"}</div>
                  <div className="text-[11px] text-[#53627A]">
                    {step === "uploading" ? "Securely uploading…" : "AI analyzing capture quality"}
                  </div>
                </div>
                <button onClick={reset} className="text-[#8893A8] hover:text-[#06194A] p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[#F4F6FA] overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]"
                  animate={{ width: `${step === "analyzing" ? 100 : progress}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#EEF0F4] bg-white p-4">
              <SectionLabel>Quality Checks</SectionLabel>
              <ul className="mt-3 space-y-2 text-[12px]">
                <CheckRow icon={Sun}        label="Lighting"  ok={checks.lighting} />
                <CheckRow icon={Scan}       label="Focus"     ok={checks.focus} />
                <CheckRow icon={Crop}       label="Framing"   ok={checks.framing} />
                <CheckRow icon={ImageIcon}  label="Glare-free" ok={checks.glare} />
              </ul>
            </div>
          </motion.div>
        )}

        {step === "ready" && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-gradient-to-br from-[#E8F8EE] to-white border border-[#BBF7D0] p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white text-[#0F7A3E] grid place-items-center shadow-sm">
                  <Check className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-[#06194A]">Capture looks great</div>
                  <div className="text-[11px] text-[#0F7A3E] font-semibold">All quality checks passed</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#EEF0F4] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#EEF0FF] text-[#4F46E5] grid place-items-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#06194A] truncate">{fileName ?? "Captured image"}</div>
                  <div className="text-[11px] text-[#53627A]">Ready to submit</div>
                </div>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <CheckPill label="Lighting" />
                <CheckPill label="Focus" />
                <CheckPill label="Framing" />
                <CheckPill label="Glare-free" />
              </ul>
            </div>

            <div className="rounded-xl bg-[#EEF0FF] border border-[#E0E7FF] px-3 py-2.5 text-[11px] text-[#4F46E5] inline-flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              We'll notify you the moment your dealer reviews this document.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SlideOver>
  );
};

const CheckRow = ({ icon: Icon, label, ok }: { icon: any; label: string; ok: boolean }) => (
  <li className="flex items-center gap-2.5">
    <span className={`w-7 h-7 rounded-xl grid place-items-center shrink-0 transition ${ok ? "bg-[#E8F8EE] text-[#0F7A3E]" : "bg-[#F4F6FA] text-[#8893A8]"}`}>
      {ok ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
    </span>
    <span className="text-[#06194A] font-semibold flex-1">{label}</span>
    <span className={`text-[10px] uppercase tracking-wide font-bold ${ok ? "text-[#0F7A3E]" : "text-[#8893A8]"}`}>
      {ok ? "Pass" : "Checking…"}
    </span>
  </li>
);

const CheckPill = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 text-[#0F7A3E] bg-[#E8F8EE] font-semibold px-2 py-1 rounded-md">
    <Check className="w-3 h-3" /> {label}
  </span>
);

export default DocumentUploadDrawer;
