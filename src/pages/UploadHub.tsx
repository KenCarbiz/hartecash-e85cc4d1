// /upload-hub/:token — mobile-first upload landing page for customers
// arriving from a QR scan or secure SMS/email link.
//
// Visually matches the portal Document Collection drawer (white cards,
// indigo accents, soft glow, rounded-2xl, premium spacing) but presented
// as a standalone landing experience optimized for a phone screen.
//
// Wraps everything in PortalDataProvider so the secure-token lookup
// reuses the existing get_submission_portal RPC — customer name,
// vehicle, dealer name all populate from real data when a token is
// present, or fall back to the mock for /upload-hub (no token).
import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Camera, Upload, Check, CheckCircle2, Clock,
  AlertCircle, Loader2, Sparkles, Sun, Crop, Eye, RefreshCw,
  ChevronRight, ArrowRight, Car, FileText, Gauge, Sofa,
  Disc3, FileWarning, CreditCard, FileSignature, IdCard,
  Wifi, Lock, MessageCircle, Home, ChevronLeft, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  PortalDataProvider, usePortalData, usePortalDataStatus,
} from "@/components/portal/PortalDataContext";
import PortalSkeleton from "@/components/PortalSkeleton";
import TokenErrorScreen from "@/components/TokenErrorScreen";
import SEO from "@/components/SEO";

/* ───────────────────────── Types ─────────────────────────── */

type ItemStatus =
  | "not_started"
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected"
  | "optional";

type UploadItem = {
  id: string;
  title: string;
  helper: string;
  icon: LucideIcon;
  status: ItemStatus;
  required: boolean;
  reason?: string;
  thumbnail?: string;
};

type UploadGroup = {
  id: "photos" | "documents";
  title: string;
  eyebrow: string;
  items: UploadItem[];
};

/* ───────────────────────── Seed data ─────────────────────── */

const INITIAL_GROUPS: UploadGroup[] = [
  {
    id: "photos",
    title: "Vehicle Photos",
    eyebrow: "Step 1",
    items: [
      { id: "front",    title: "Front 3/4 view",   helper: "Bumper, grille, both headlights visible", icon: Car,     status: "approved",    required: true },
      { id: "rear",     title: "Rear 3/4 view",    helper: "Bumper, taillights, plate visible",       icon: Car,     status: "approved",    required: true },
      { id: "driver",   title: "Driver side",      helper: "Full side profile, all wheels visible",   icon: Car,     status: "uploaded",    required: true },
      { id: "passenger",title: "Passenger side",   helper: "Full side profile, no glare",             icon: Car,     status: "not_started", required: true },
      { id: "odometer", title: "Odometer",         helper: "Dash lit, current mileage clearly readable", icon: Gauge, status: "not_started", required: true },
      { id: "interior", title: "Interior",         helper: "Seats and dashboard from driver door",    icon: Sofa,    status: "not_started", required: true },
      { id: "wheels",   title: "Wheels & tires",   helper: "One clear shot of tread + rim",           icon: Disc3,   status: "not_started", required: false },
      { id: "damage",   title: "Damage (optional)",helper: "Any dents, scratches, or chips",          icon: FileWarning, status: "optional", required: false },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    eyebrow: "Step 2",
    items: [
      { id: "dl",        title: "Driver's License", helper: "Front side, clear and in focus",         icon: IdCard,         status: "rejected",    required: true, reason: "Image was blurry — please retake in better light." },
      { id: "reg",       title: "Registration",     helper: "Current and matches the vehicle",        icon: FileText,       status: "under_review", required: true },
      { id: "title",     title: "Title",            helper: "If you have it on hand",                 icon: FileSignature,  status: "not_started", required: true },
      { id: "insurance", title: "Insurance Card",   helper: "Active policy, both sides if needed",    icon: ShieldCheck,    status: "not_started", required: true },
      { id: "payoff",    title: "Payoff Statement", helper: "Only if your vehicle has a loan",        icon: CreditCard,     status: "optional",    required: false },
    ],
  },
];

/* ───────────────────────── Status styling ───────────────── */

const STATUS_TONE: Record<ItemStatus, { label: string; pill: string; dot: string; Icon: LucideIcon }> = {
  approved:     { label: "Approved",      pill: "text-[#0F7A3E] bg-[#E8F8EE]",  dot: "bg-[#16A34A]", Icon: CheckCircle2 },
  uploaded:     { label: "Uploaded",      pill: "text-[#6D28D9] bg-[#EEF0FF]",  dot: "bg-[#6D28D9]", Icon: Check },
  under_review: { label: "Under review",  pill: "text-[#B45309] bg-[#FEF3E2]",  dot: "bg-[#F59E0B]", Icon: Loader2 },
  rejected:     { label: "Needs retake",  pill: "text-[#B91C1C] bg-[#FEE2E2]",  dot: "bg-[#EF4444]", Icon: AlertCircle },
  not_started:  { label: "Not started",   pill: "text-[#53627A] bg-[#F4F6FA]",  dot: "bg-[#94A3B8]", Icon: Clock },
  optional:     { label: "Optional",      pill: "text-[#6D28D9] bg-[#F5F0FF]",  dot: "bg-[#A78BFA]", Icon: Sparkles },
};

const STATUS_HELPER: Partial<Record<ItemStatus, string>> = {
  approved: "Looks good.",
  under_review: "We're checking this now.",
  uploaded: "Synced — awaiting review.",
};

/* ───────────────────────── Layout primitives ─────────────── */

const Card = ({ className = "", children }: { className?: string; children: ReactNode }) => (
  <div className={`bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
    {children}
  </div>
);

const PrimaryBtn = ({
  children, onClick, className = "", disabled,
}: { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-[14px] font-semibold text-white bg-gradient-to-r from-[#6D28D9] to-[#6D28D9] hover:opacity-95 active:scale-[0.98] transition shadow-[0_10px_28px_-12px_rgba(79,70,229,0.6)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const SecondaryBtn = ({
  children, onClick, className = "",
}: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-[14px] font-semibold text-[#06194A] bg-white border border-[#E6EAF0] hover:border-[#6D28D9]/40 hover:text-[#6D28D9] active:scale-[0.98] transition ${className}`}
  >
    {children}
  </button>
);

const TrustChip = ({ Icon, children }: { Icon: LucideIcon; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#53627A] bg-white/70 backdrop-blur-sm border border-[#E6EAF0] rounded-full px-2.5 py-1">
    <Icon className="w-3 h-3 text-[#6D28D9]" />
    {children}
  </span>
);

const StatusPill = ({ status }: { status: ItemStatus }) => {
  const t = STATUS_TONE[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${t.pill}`}>
      <t.Icon className={`w-3 h-3 ${status === "under_review" ? "animate-spin" : ""}`} />
      {t.label}
    </span>
  );
};

/* ───────────────────────── Upload row ────────────────────── */

const UploadRow = ({
  item, onUpload, onPreview,
}: { item: UploadItem; onUpload: (id: string) => void; onPreview: (id: string) => void }) => {
  const t = STATUS_TONE[item.status];
  const helper = STATUS_HELPER[item.status] ?? item.helper;
  const isDone = item.status === "approved" || item.status === "uploaded" || item.status === "under_review";
  const isBad = item.status === "rejected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex items-start gap-3 p-3.5 rounded-xl border transition ${
        isBad ? "border-[#FECACA] bg-[#FFFBFB]" : "border-[#E6EAF0] bg-white hover:border-[#6D28D9]/25"
      }`}
    >
      <div className={`relative w-11 h-11 rounded-xl grid place-items-center shrink-0 ${
        isDone ? "bg-[#EEF0FF]" : isBad ? "bg-[#FEE2E2]" : "bg-[#F4F6FA]"
      }`}>
        <item.icon className={`w-5 h-5 ${
          isDone ? "text-[#6D28D9]" : isBad ? "text-[#B91C1C]" : "text-[#53627A]"
        }`} />
        {isDone && (
          <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white ${t.dot}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[13.5px] font-semibold text-[#06194A] leading-tight">{item.title}</div>
          <StatusPill status={item.status} />
        </div>
        <div className={`text-[12px] mt-0.5 leading-snug ${isBad ? "text-[#B91C1C]" : "text-[#53627A]"}`}>
          {isBad ? item.reason : helper}
        </div>
      </div>

      <div className="shrink-0 self-center">
        {isDone ? (
          <button
            onClick={() => onPreview(item.id)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] px-2.5 py-1.5 rounded-lg hover:bg-[#EEF0FF] transition"
            aria-label={`Preview ${item.title}`}
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
        ) : (
          <button
            onClick={() => onUpload(item.id)}
            className={`inline-flex items-center gap-1 text-[12px] font-semibold rounded-lg px-3 py-2 transition active:scale-95 ${
              isBad
                ? "text-white bg-[#EF4444] hover:bg-[#DC2626]"
                : "text-white bg-gradient-to-r from-[#6D28D9] to-[#6D28D9] hover:opacity-95"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            {isBad ? "Retake" : "Upload"}
          </button>
        )}
      </div>
    </motion.div>
  );
};

/* ───────────────────────── Hero / progress ───────────────── */

const Hero = ({
  dealer, completed, total,
}: { dealer: string; completed: number; total: number }) => {
  const pct = Math.round((completed / Math.max(total, 1)) * 100);
  return (
    <div className="relative overflow-hidden">
      {/* ambient glow */}
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#6D28D9]/20 blur-3xl pointer-events-none" />
      <div className="absolute -top-12 right-0 w-80 h-80 rounded-full bg-[#6D28D9]/15 blur-3xl pointer-events-none" />

      <div className="relative px-5 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[#6D28D9]">
            Secure Upload Hub
          </div>
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#0F7A3E] bg-[#E8F8EE] rounded-full px-2 py-0.5">
            <Lock className="w-3 h-3" />
            Secure session
          </span>
        </div>

        <h1 className="mt-2 text-[22px] sm:text-[26px] font-extrabold text-[#06194A] leading-tight tracking-tight">
          Complete your photo &amp; document upload
        </h1>
        <p className="mt-1.5 text-[13px] text-[#53627A] leading-relaxed">
          Upload the remaining items from your phone. Everything syncs securely with your offer at{" "}
          <span className="font-semibold text-[#06194A]">{dealer}</span> in real time.
        </p>

        {/* progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[12px] font-semibold text-[#06194A]">
              <span className="text-[#6D28D9]">{completed}</span>
              <span className="text-[#53627A]"> of {total} completed</span>
            </div>
            <div className="text-[11px] font-semibold text-[#53627A]">{pct}%</div>
          </div>
          <div className="h-2 rounded-full bg-[#EEF0FF] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#6D28D9]"
            />
          </div>
        </div>

        {/* trust chips */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <TrustChip Icon={ShieldCheck}>SOC 2</TrustChip>
          <TrustChip Icon={Lock}>Encrypted in transit</TrustChip>
          <TrustChip Icon={Wifi}>Synced live</TrustChip>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────── Session summary ───────────────── */

const SessionCard = ({
  firstName, vehicle, dealer, expiresIn,
}: { firstName: string; vehicle: string; dealer: string; expiresIn: string }) => (
  <Card className="p-3.5">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] grid place-items-center text-white font-bold text-[14px]">
        {(firstName || "?")[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-[#8893A8]">For {firstName || "you"}</div>
        <div className="text-[13.5px] font-bold text-[#06194A] truncate">{vehicle}</div>
        <div className="text-[11.5px] text-[#53627A] truncate">{dealer}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wide font-semibold text-[#8893A8]">Session</div>
        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F7A3E]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
          {expiresIn}
        </div>
      </div>
    </div>
  </Card>
);

/* ───────────────────────── Next action ───────────────────── */

const NextActionCard = ({
  item, onUpload,
}: { item: UploadItem | null; onUpload: (id: string) => void }) => {
  if (!item) return null;
  return (
    <Card className="overflow-hidden">
      <div className="relative p-4 bg-gradient-to-br from-[#EEF0FF] via-white to-[#F5F0FF]">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-[#6D28D9]/10 blur-2xl pointer-events-none" />
        <div className="flex items-start gap-3 relative">
          <div className="w-11 h-11 rounded-xl bg-white grid place-items-center shadow-sm shrink-0">
            <item.icon className="w-5 h-5 text-[#6D28D9]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] uppercase tracking-[0.14em] font-bold text-[#6D28D9]">
              Next required item
            </div>
            <div className="text-[16px] font-bold text-[#06194A] mt-0.5">{item.title}</div>
            <div className="text-[12.5px] text-[#53627A] mt-1 leading-snug">{item.helper}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 relative">
          <PrimaryBtn onClick={() => onUpload(item.id)} className="w-full">
            <Camera className="w-4 h-4" /> Open Camera
          </PrimaryBtn>
          <SecondaryBtn onClick={() => onUpload(item.id)} className="w-full">
            <Upload className="w-4 h-4" /> From Device
          </SecondaryBtn>
        </div>
      </div>
    </Card>
  );
};

/* ───────────────────────── Tips card ────────────────────── */

const TIPS: { Icon: LucideIcon; text: string }[] = [
  { Icon: Sun,         text: "Use good, even lighting — avoid harsh shadows." },
  { Icon: Crop,        text: "Keep the full document or angle in frame." },
  { Icon: Camera,      text: "Hold steady — wait for focus before tapping." },
  { Icon: FileText,    text: "Place docs on a flat, plain background." },
];

const TipsCard = () => (
  <Card className="p-4">
    <div className="flex items-center gap-2 mb-2.5">
      <div className="w-7 h-7 rounded-lg bg-[#F5F0FF] grid place-items-center">
        <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
      </div>
      <div className="text-[13px] font-bold text-[#06194A]">Tips for best results</div>
    </div>
    <ul className="space-y-1.5">
      {TIPS.map(({ Icon, text }) => (
        <li key={text} className="flex items-start gap-2 text-[12.5px] text-[#53627A] leading-snug">
          <Icon className="w-3.5 h-3.5 text-[#6D28D9] mt-0.5 shrink-0" />
          {text}
        </li>
      ))}
    </ul>
  </Card>
);

/* ───────────────────────── Live-sync notice ──────────────── */

const LiveSyncBadge = () => (
  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#EEF0FF] to-[#F5F0FF] border border-[#E0E7FF]">
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6D28D9] opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6D28D9]" />
    </span>
    <div className="text-[12px] text-[#06194A]">
      <span className="font-semibold">Live sync</span>
      <span className="text-[#53627A]"> — uploads appear instantly in your dealer portal.</span>
    </div>
  </div>
);

/* ───────────────────────── Completion state ──────────────── */

const CompletionCard = ({ onReturn, onViewOffer, onMessage }: {
  onReturn: () => void; onViewOffer: () => void; onMessage: () => void;
}) => (
  <Card className="overflow-hidden">
    <div className="relative p-6 text-center bg-gradient-to-br from-[#E8F8EE] via-white to-[#EEF0FF]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.12),transparent_60%)] pointer-events-none" />
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#16A34A] to-[#0F7A3E] grid place-items-center mx-auto shadow-[0_12px_24px_-8px_rgba(22,163,74,0.5)]"
      >
        <Check className="w-8 h-8 text-white" strokeWidth={3} />
      </motion.div>
      <h2 className="mt-4 text-[20px] font-extrabold text-[#06194A]">All set — uploads complete</h2>
      <p className="mt-1.5 text-[13px] text-[#53627A] leading-relaxed max-w-[320px] mx-auto">
        Your dealer now has everything needed to continue your offer review.
      </p>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <PrimaryBtn onClick={onReturn}><Home className="w-4 h-4" /> Return to portal</PrimaryBtn>
        <SecondaryBtn onClick={onViewOffer}><ArrowRight className="w-4 h-4" /> View offer</SecondaryBtn>
        <SecondaryBtn onClick={onMessage}><MessageCircle className="w-4 h-4" /> Message dealer</SecondaryBtn>
      </div>
    </div>
  </Card>
);

/* ───────────────────────── Main page ─────────────────────── */

const UploadHubInner = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const MOCK = usePortalData();
  const { loading, tokenStatus } = usePortalDataStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingId = useRef<string | null>(null);

  const [groups, setGroups] = useState<UploadGroup[]>(INITIAL_GROUPS);

  /* progress */
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const requiredItems = allItems.filter((i) => i.required);
  const requiredDone = requiredItems.filter((i) => i.status === "approved" || i.status === "uploaded" || i.status === "under_review").length;
  const totalRequired = requiredItems.length;
  const allComplete = requiredDone === totalRequired;

  /* next required item — prioritise rejected, then not_started */
  const nextItem = useMemo(() => {
    return requiredItems.find((i) => i.status === "rejected")
        ?? requiredItems.find((i) => i.status === "not_started")
        ?? null;
  }, [requiredItems]);

  /* upload simulation — wired to a hidden file input. In a real flow
     this would call uploadDocument()/uploadPhoto() against Supabase
     Storage with the secure session token. */
  const handleUpload = (id: string) => {
    pendingId.current = id;
    fileInputRef.current?.click();
  };

  const handleFile = (file: File | null) => {
    const id = pendingId.current;
    pendingId.current = null;
    if (!id || !file) return;
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((i) => i.id === id ? { ...i, status: "uploaded" as ItemStatus, reason: undefined } : i),
      })),
    );
    toast.success("Uploaded — syncing to your dealer portal", { duration: 2400 });
    // Auto-promote uploaded → under_review for the demo feel.
    setTimeout(() => {
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          items: g.items.map((i) => i.id === id && i.status === "uploaded"
            ? { ...i, status: "under_review" as ItemStatus } : i),
        })),
      );
    }, 2200);
  };

  const handlePreview = (id: string) => {
    const item = allItems.find((i) => i.id === id);
    if (item) toast.info(`Preview ${item.title}`, { description: "Preview drawer coming soon." });
  };

  /* status screens */
  if (loading) return <PortalSkeleton headline="Loading your upload session" />;
  if (tokenStatus && tokenStatus !== "valid") return <TokenErrorScreen status={tokenStatus} />;

  const vehicleStr = `${MOCK.vehicle.year || ""} ${MOCK.vehicle.make || ""} ${MOCK.vehicle.model || ""} ${MOCK.vehicle.trim || ""}`.trim();
  const returnHome = () => navigate(token ? `/my-submission/${token}` : "/portal-preview");

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#06194A]">
      <SEO title="Upload Hub" description="Secure upload session — not indexed." path={token ? `/upload-hub/${token}` : "/upload-hub"} noindex />

      {/* hidden uploader */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {/* compact top bar — back to portal */}
      <div className="sticky top-0 z-20 bg-[#F7F8FB]/85 backdrop-blur-md border-b border-[#E6EAF0]">
        <div className="max-w-[640px] lg:max-w-[1100px] mx-auto px-4 h-12 flex items-center justify-between">
          <button
            onClick={returnHome}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#53627A] hover:text-[#6D28D9] transition"
          >
            <ChevronLeft className="w-4 h-4" /> Portal
          </button>
          <div className="text-[12px] font-bold text-[#06194A] truncate max-w-[60%]">{MOCK.customer.dealer}</div>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-[640px] lg:max-w-[1100px] mx-auto pb-32 lg:pb-10">
        {/* Hero */}
        <Hero dealer={MOCK.customer.dealer} completed={requiredDone} total={totalRequired} />

        {/* Body — single column on mobile, 2-col on desktop */}
        <div className="px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          {/* LEFT — tasks */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {allComplete ? (
                <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <CompletionCard
                    onReturn={returnHome}
                    onViewOffer={() => navigate(token ? `/my-submission/${token}` : "/portal-preview")}
                    onMessage={() => toast.info("Message dealer", { description: "Opens the conversation thread." })}
                  />
                </motion.div>
              ) : (
                <motion.div key="next" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <NextActionCard item={nextItem} onUpload={handleUpload} />
                </motion.div>
              )}
            </AnimatePresence>

            <LiveSyncBadge />

            {/* Task groups */}
            {groups.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#6D28D9]">{g.eyebrow}</div>
                    <div className="text-[15px] font-bold text-[#06194A]">{g.title}</div>
                  </div>
                  <div className="text-[11.5px] font-semibold text-[#53627A]">
                    {g.items.filter((i) => i.status === "approved" || i.status === "uploaded" || i.status === "under_review").length}/
                    {g.items.filter((i) => i.required).length}
                  </div>
                </div>
                <div className="space-y-2">
                  {g.items.map((i) => (
                    <UploadRow key={i.id} item={i} onUpload={handleUpload} onPreview={handlePreview} />
                  ))}
                </div>
              </Card>
            ))}

            {/* Mobile: tips below tasks. Desktop: lives in sidebar. */}
            <div className="lg:hidden">
              <TipsCard />
            </div>
          </div>

          {/* RIGHT sidebar (desktop only) */}
          <aside className="hidden lg:block space-y-4 sticky top-16 self-start">
            <SessionCard
              firstName={MOCK.customer.firstName}
              vehicle={vehicleStr || "Your vehicle"}
              dealer={MOCK.customer.dealer}
              expiresIn="Active"
            />
            <TipsCard />
            <Card className="p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#6D28D9]">Need help?</div>
              <div className="text-[13px] font-bold text-[#06194A] mt-0.5">We're a tap away</div>
              <p className="text-[12px] text-[#53627A] mt-1 leading-relaxed">
                Stuck on a photo or document? Message your dealer and we'll guide you through it.
              </p>
              <SecondaryBtn className="w-full mt-3" onClick={() => toast.info("Open conversation")}>
                <MessageCircle className="w-4 h-4" /> Message dealer
              </SecondaryBtn>
            </Card>
          </aside>
        </div>
      </div>

      {/* Sticky bottom action bar (mobile + tablet) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E6EAF0] shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.12)]">
        <div className="max-w-[640px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11.5px] font-semibold text-[#53627A]">
              <span className="text-[#06194A] font-bold">{requiredDone}/{totalRequired}</span> required complete
            </div>
            {!allComplete && nextItem && (
              <div className="text-[11px] text-[#53627A]">
                Next: <span className="font-semibold text-[#06194A]">{nextItem.title}</span>
              </div>
            )}
          </div>
          {allComplete ? (
            <PrimaryBtn onClick={returnHome} className="w-full">
              <Check className="w-4 h-4" /> Finish &amp; return to portal
            </PrimaryBtn>
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <PrimaryBtn onClick={() => nextItem && handleUpload(nextItem.id)} className="w-full">
                Continue Upload <ChevronRight className="w-4 h-4" />
              </PrimaryBtn>
              <SecondaryBtn onClick={returnHome} className="px-3">
                Save
              </SecondaryBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UploadHub = () => {
  const { token } = useParams<{ token: string }>();
  return (
    <PortalDataProvider token={token}>
      <UploadHubInner />
    </PortalDataProvider>
  );
};

export default UploadHub;
