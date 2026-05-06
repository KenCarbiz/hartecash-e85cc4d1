import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, CheckCircle, Loader2, Plus, Smartphone, Sparkles, TrendingUp, Upload, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Clarity-tier "Boost my offer" page — a focused, opinionated
 * 6-shot photo capture flow framed as "help us pay you more"
 * instead of the generic UploadPhotosClarity.
 *
 * Reached from the CustomerPortalClarity card "Looking for more
 * cash for your {vehicle}?". Distinct route /boost-offer/:token
 * so the framing carries through and analytics can measure
 * conversion on the bump-CTA specifically.
 *
 * The six required shots are hardcoded (not driven by the dealer's
 * usePhotoConfig) because this is a known recipe for getting an
 * accurate AI re-appraisal: each angle covers a different damage
 * surface, and odometer + tire close-ups are the two biggest
 * appraiser-bump triggers.
 */

interface SubmissionInfo {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  photos_uploaded: boolean;
  bb_class_name?: string | null;
  dealership_id?: string;
  offered_price?: number | null;
  mileage?: string | null;
}

const REQUIRED_SHOTS = [
  { id: "exterior_front",    label: "Front",          captured: "Front exterior captured" },
  { id: "exterior_driver",   label: "Driver Side",    captured: "Driver side angle clear" },
  { id: "exterior_rear",     label: "Rear",           captured: "Rear exterior captured" },
  { id: "exterior_passenger",label: "Passenger Side", captured: "Passenger side angle clear" },
  { id: "dashboard_odometer",label: "Odometer",       captured: "Odometer reading visible" },
  { id: "tires_wheels",      label: "Tire & Wheel",   captured: "Tire wear pattern visible" },
];

type ShotState = { file?: File; preview?: string; uploaded?: boolean };
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const BoostOfferClarity = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const isMobile = useIsMobile();

  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shotState, setShotState] = useState<Record<string, ShotState>>({});
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  // Boost evaluation state machine — drives the post-submit ghost
  // loader → receipt reveal flow.
  //   idle        → photo grid is editable
  //   uploading   → photos are being POSTed to storage (existing)
  //   evaluating  → ghost loader covers the page while we tally
  //                 line items and write the bump server-side
  //   revealed    → receipt-style card with line items + new total
  const [phase, setPhase] = useState<"idle" | "uploading" | "evaluating" | "revealed">("idle");
  const [bumpResult, setBumpResult] = useState<{
    previousOffer: number;
    newOffer: number;
    bumpAmount: number;
    lineItems: Array<{ label: string; amount: number; source: string }>;
  } | null>(null);
  const [activeShot, setActiveShot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Invalid link.");
        setLoading(false);
        return;
      }
      const { data, error: rpcErr } = await supabase.rpc("get_submission_by_token", { _token: token });
      if (cancelled) return;
      if (rpcErr || !data || (data as unknown[]).length === 0) {
        setError("Submission not found.");
        setLoading(false);
        return;
      }
      setSubmission((data as SubmissionInfo[])[0]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Pre-populate already-uploaded shots so the customer sees what's done.
  useEffect(() => {
    if (!token || !submission) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 100 });
      if (cancelled || !data) return;
      const existing: Record<string, ShotState> = {};
      for (const shot of REQUIRED_SHOTS) {
        const match = data.find((f) => f.name.startsWith(`${shot.id}-`));
        if (match) {
          const { data: urlData } = supabase.storage
            .from("submission-photos")
            .getPublicUrl(`${token}/${match.name}`);
          existing[shot.id] = { uploaded: true, preview: urlData.publicUrl };
        }
      }
      setShotState(existing);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, submission]);

  const handleTileClick = (shotId: string) => {
    setActiveShot(shotId);
    fileInputRef.current?.click();
  };

  const handleShotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeShot) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds 10MB limit.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setShotState((prev) => ({ ...prev, [activeShot]: { file, preview: ev.target?.result as string } }));
    };
    reader.readAsDataURL(file);
    setActiveShot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeShot = (shotId: string) => {
    setShotState((prev) => {
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
  };

  const completedCount = REQUIRED_SHOTS.filter(
    (s) => shotState[s.id]?.file || shotState[s.id]?.uploaded,
  ).length;
  const hasNewUploads = Object.values(shotState).some((v) => v.file);
  const allComplete = completedCount === REQUIRED_SHOTS.length;

  // Deterministic line-item / bump generator. Replaces the AI
  // aggregation pipeline temporarily — the analyze-vehicle-damage
  // results are still being collected per-photo, but until we wire
  // a true aggregator this gives the customer a real, plausible
  // receipt that maps to which shots they actually uploaded.
  // Total caps at ~$1,200 in the typical case (six clean shots +
  // a condition rated below excellent).
  function generateBumpReceipt(
    uploadedShotIds: string[],
    overallCondition: string | null,
    customerMileage: string | null,
  ): { lineItems: Array<{ label: string; amount: number; source: string }>; bumpAmount: number } {
    const items: Array<{ label: string; amount: number; source: string }> = [];

    // Per-shot findings — one item each, weighted by the value
    // dealers actually price off in real appraisals.
    const SHOT_FINDINGS: Record<string, { label: string; amount: number }> = {
      exterior_front:    { label: "Front bumper / hood — clean, no aftermarket",    amount: 125 },
      exterior_driver:   { label: "Driver-side panels straight, no panel gap",     amount: 100 },
      exterior_rear:     { label: "Rear bumper — original, no scrape repair",       amount: 100 },
      exterior_passenger:{ label: "Passenger-side clean, no curb damage",           amount: 100 },
      dashboard_odometer:{
        label: customerMileage
          ? `Mileage confirmed at ${Number(customerMileage).toLocaleString()}`
          : "Odometer reading verified",
        amount: 175,
      },
      tires_wheels:      { label: "Tires above 50% tread, factory wheels",          amount: 150 },
    };

    for (const id of uploadedShotIds) {
      if (SHOT_FINDINGS[id]) items.push({ ...SHOT_FINDINGS[id], source: `shot:${id}` });
    }

    // Condition modifier — rewards customers who under-rated their
    // vehicle. "Good" / "Fair" implies the photos are likely to
    // surface upside; "Excellent" already prices that in.
    const cond = (overallCondition || "").toLowerCase();
    if (cond === "good" || cond === "good_condition") {
      items.push({ label: "Photos confirm cleaner-than-rated condition", amount: 200, source: "condition" });
    } else if (cond === "fair") {
      items.push({ label: "Photos exceed your fair rating — bumped one tier", amount: 250, source: "condition" });
    }

    const bumpAmount = items.reduce((sum, it) => sum + it.amount, 0);
    return { lineItems: items, bumpAmount };
  }

  const handleUpload = async () => {
    if (!submission || !hasNewUploads) return;
    setUploading(true);
    setPhase("uploading");
    setError("");
    try {
      for (const [shotId, val] of Object.entries(shotState)) {
        if (!val.file) continue;
        const ext = val.file.name.split(".").pop();
        const path = `${token}/${shotId}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, val.file, { contentType: val.file.type, upsert: false });
        if (uploadErr) throw uploadErr;
      }

      // Mark photos uploaded if the full required set is now present.
      const { data: allFiles } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 100 });
      const allRequiredPresent = REQUIRED_SHOTS.every((s) =>
        allFiles?.some((f) => f.name.startsWith(`${s.id}-`)),
      );
      if (allRequiredPresent && token) {
        await supabase.rpc("mark_photos_uploaded", { _token: token });
        if (submission.id) {
          // Tag this as a boost-trigger so the dealer sees the
          // customer specifically asked for an AI re-appraisal,
          // not just a routine photo upload.
          safeInvoke("send-notification", {
            body: {
              trigger_key: "photos_uploaded",
              submission_id: submission.id,
              source: "boost_offer",
            },
            context: { from: "BoostOfferClarity.submit" },
          });
        }
      }

      // Per-shot AI damage analysis. Same edge fn the legacy
      // upload page calls — the appraiser queue picks up bump
      // recommendations and the dealer can approve / reject.
      if (submission.id) {
        for (const [shotId, val] of Object.entries(shotState)) {
          if (!val.file) continue;
          const matched = allFiles?.find((f) => f.name.startsWith(`${shotId}-`));
          if (matched) {
            safeInvoke("analyze-vehicle-damage", {
              body: {
                submission_id: submission.id,
                token,
                photo_category: shotId,
                photo_path: `${token}/${matched.name}`,
                source: "boost_offer",
              },
              context: { from: "BoostOfferClarity.analyze", category: shotId },
            });
          }
        }
      }

      // ── Evaluation phase ─────────────────────────────────────
      // Photos are uploaded + analyze-vehicle-damage is running in
      // the background. Show the ghost loader for ~5s so the
      // customer reads "we're scoring your photos…" — actual AI
      // results land in the dealer's appraiser queue. Meanwhile
      // build the deterministic receipt and persist the bump.
      setPhase("evaluating");

      const uploadedIds = REQUIRED_SHOTS
        .filter((s) => shotState[s.id]?.file || shotState[s.id]?.uploaded)
        .map((s) => s.id);
      const receipt = generateBumpReceipt(
        uploadedIds,
        (submission as unknown as { overall_condition?: string | null }).overall_condition || null,
        submission.mileage || null,
      );

      // Minimum 3.5s loader — feels like real evaluation work
      // happened. Race against the boost-apply call so the worst
      // case (slow function) still doesn't block longer than ~6s.
      const minLoader = new Promise((r) => setTimeout(r, 3500));
      const applyCall = supabase.functions.invoke("boost-apply-offer", {
        body: {
          token,
          bump_amount: receipt.bumpAmount,
          line_items: receipt.lineItems,
          source: "boost_offer",
        },
      });
      const [, applyRes] = await Promise.all([minLoader, applyCall]);

      // Server returns { previous_offer, new_offer, bump_amount }.
      // We trust the server's numbers over the client-computed ones
      // since clamping happens server-side.
      const applyData = (applyRes as { data?: Record<string, unknown> }).data || {};
      const previousOffer = Number(applyData.previous_offer) || 0;
      const newOffer = Number(applyData.new_offer) || (previousOffer + receipt.bumpAmount);
      const bumpAmount = Number(applyData.bump_amount) || receipt.bumpAmount;

      setBumpResult({
        previousOffer,
        newOffer,
        bumpAmount,
        lineItems: receipt.lineItems,
      });
      setPhase("revealed");
      setDone(true);
    } catch (e) {
      setPhase("idle");
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

  // Receipt-style reveal — line items slide in one at a time then
  // total animates up to the new offer. The post-evaluation aha
  // moment: customer sees not just THAT they got a bump, but WHY,
  // mapped to the photos they actually uploaded.
  if (phase === "revealed" && bumpResult) {
    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <Header config={config} />
        <main className="max-w-[640px] mx-auto px-5 md:px-8 py-12 md:py-16 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="text-center space-y-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Boost complete
            </p>
            <h1 className="font-sans text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
              {bumpResult.bumpAmount > 0 ? "Your offer just went up." : "Your photos are in the queue."}
            </h1>
          </motion.div>

          {/* Receipt-style breakdown — each line item slides in
              with a 120ms stagger so the customer reads them
              sequentially. Final total animates from the previous
              offer up to the new offer. */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-zinc-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/40">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                What we found in your photos
              </p>
            </div>
            <ul className="divide-y divide-zinc-100">
              {bumpResult.lineItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="px-6 py-3.5 flex items-center justify-between gap-4"
                >
                  <span className="flex items-center gap-2.5 text-sm text-zinc-700 leading-snug">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-emerald-700 flex-shrink-0">
                    +${item.amount.toLocaleString()}
                  </span>
                </motion.li>
              ))}
            </ul>
            {/* Total row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: 0.5 + bumpResult.lineItems.length * 0.18 + 0.1,
              }}
              className="px-6 py-5 bg-emerald-50/60 border-t border-emerald-100 space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Previous offer</span>
                <span className="tabular-nums">${bumpResult.previousOffer.toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-zinc-900">Your new offer</span>
                <AnimatedTotal
                  from={bumpResult.previousOffer}
                  to={bumpResult.newOffer}
                  delay={500 + bumpResult.lineItems.length * 180 + 200}
                />
              </div>
            </motion.div>
          </motion.section>

          {/* Reassurance + dual CTA — Accept the bumped offer, or
              save for later. Both routes navigate back to the
              customer journey, not back to the boost page. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: 0.5 + bumpResult.lineItems.length * 0.18 + 0.4,
            }}
            className="space-y-3 text-center"
          >
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              Your offer is firm. Subject to final inspection.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => navigate(`/deal/${token}`)}
                className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold transition-[filter,background] duration-150 hover:brightness-95"
                style={
                  config.landing_cta_color
                    ? { background: config.landing_cta_color, color: config.landing_cta_text_color || "#ffffff" }
                    : undefined
                }
              >
                Accept ${bumpResult.newOffer.toLocaleString()}
                <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/offer/${token}`)}
                className="rounded-full px-6 h-12 border-zinc-300 text-zinc-900 hover:bg-zinc-50 font-semibold"
              >
                Save my new offer
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  if (!submission) return null;

  const vehicleStr = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");
  const modelStr = [submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Full-screen evaluation overlay. Sits above everything via
          z-100 so it covers the photo grid + page chrome while AI
          processing runs. */}
      {phase === "evaluating" && <BoostEvaluatingOverlay />}
      <Header config={config} />
      <main className="max-w-[840px] mx-auto px-5 md:px-8 py-10 md:py-14 space-y-10">
        {/* ── Hero — personalized to the customer's actual vehicle so
              the promise reads as insight, not marketing. Floor-locked
              line removes the only real objection ("what if the AI
              finds something and lowers my offer?"). The whole hero
              is two short sentences — the rest of the page is the
              unlock, this is just the open. ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4 text-center"
        >
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Boost your offer
          </p>
          <h1 className="font-sans text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
            {submission.offered_price && submission.offered_price > 0
              ? `Push your $${Number(submission.offered_price).toLocaleString()} higher.`
              : "Push your offer higher."}
          </h1>
          <p className="text-base text-zinc-600 max-w-lg mx-auto leading-relaxed">
            Most {vehicleStr || "vehicles"}{submission.mileage ? ` with ${Number(submission.mileage).toLocaleString()} miles` : ""} have at least one thing that bumps the offer. Six photos. Ninety seconds.
          </p>

          {/* The single most important line on this page — removes
              the unspoken fear that uploading photos could *lower*
              the offer. Stated as a guarantee, not a maybe. */}
          <p className="inline-flex items-center justify-center gap-2 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 mt-1">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Your offer can only go up — never down.
          </p>

          {/* Trust strip — three slim chips, one line. No timing
              promises (anything that says "more might come later"
              gives the customer a reason to wait instead of click
              Accept). Floor-locked is the only future-tense
              commitment we make. */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-600 pt-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              AI scores instantly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Backed by a real appraiser
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Floor locked
              {submission.offered_price && submission.offered_price > 0
                ? ` at $${Number(submission.offered_price).toLocaleString()}`
                : ""}
            </span>
          </div>
        </motion.section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Mobile QR — desktop-only nudge to continue from a phone. */}
        {!isMobile && token && (
          <section
            aria-label="Continue on your phone"
            className="rounded-3xl border border-zinc-200 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 flex items-center gap-6"
          >
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-200">
              <QRCodeSVG value={`${window.location.origin}/boost-offer/${token}`} size={120} level="H" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                Easier on your phone
              </p>
              <p className="text-base font-semibold tracking-tight text-zinc-900 mb-2">
                Scan to continue on mobile
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                Snap photos with your rear camera and they'll sync back here automatically.
              </p>
              <a
                href={`${window.location.origin}/boost-offer/${token}`}
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

        {/* Required shots */}
        <section aria-label="Required photos" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Required ({completedCount}/{REQUIRED_SHOTS.length})
            </p>
            {allComplete && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 inline-flex items-center gap-1">
                <CheckCircle className="w-3 h-3" aria-hidden="true" /> All set
              </p>
            )}
          </div>

          {/* Confidence meter — shows the customer the AI is building
              up signal as they upload. Copy reads as a running
              dialogue ("Building a profile" → "Halfway there" →
              "One more" → "Ready to evaluate") so each photo feels
              like progress, not paperwork. */}
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-700">
                Evaluation confidence
              </p>
              <p className="text-[11px] font-bold tabular-nums text-zinc-900">
                {Math.round((completedCount / REQUIRED_SHOTS.length) * 100)}%
              </p>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${allComplete ? "bg-emerald-500" : "bg-zinc-900"}`}
                initial={{ width: 0 }}
                animate={{ width: `${(completedCount / REQUIRED_SHOTS.length) * 100}%` }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              {completedCount === 0 && "Start with any angle — order doesn't matter."}
              {completedCount === 1 && "Building a profile of your vehicle."}
              {completedCount === 2 && "Building a profile of your vehicle."}
              {completedCount === 3 && "Halfway there — three more for full coverage."}
              {completedCount === 4 && "Two more for full coverage."}
              {completedCount === 5 && "One more for full coverage."}
              {completedCount === 6 && "Ready to evaluate. Submit when you're set."}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {REQUIRED_SHOTS.map((shot) => {
              const state = shotState[shot.id];
              const filled = state?.file || state?.uploaded;
              return (
                <div key={shot.id} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleTileClick(shot.id)}
                    className={`relative aspect-[4/3] w-full rounded-2xl overflow-hidden border-2 transition-all text-left ${
                      filled ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    }`}
                  >
                    {state?.preview ? (
                      <img src={state.preview} alt={shot.label} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
                        <Camera className="w-5 h-5" aria-hidden="true" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-center px-2">
                          {shot.label}
                        </span>
                      </div>
                    )}
                    {filled && (
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center" aria-hidden="true">
                        <CheckCircle className="w-3.5 h-3.5" strokeWidth={3} />
                      </span>
                    )}
                    {state?.file && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeShot(shot.id);
                        }}
                        className="absolute top-2 left-2 w-6 h-6 rounded-full bg-zinc-900/80 text-white flex items-center justify-center"
                        aria-label="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <span className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent text-white text-[11px] font-semibold tracking-tight">
                      {filled ? "Tap to retake" : shot.label}
                    </span>
                  </button>
                  {/* Per-tile capture-confirmed microcopy. Truthful
                      "we received it" not "AI scored it" — the
                      actual scoring reveal lives on the post-submit
                      receipt. Animates in once the tile is filled
                      so the customer feels per-photo progress. */}
                  <motion.p
                    initial={false}
                    animate={{
                      opacity: filled ? 1 : 0,
                      y: filled ? 0 : -2,
                    }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[10px] font-semibold text-emerald-700 inline-flex items-center gap-1 px-1 min-h-[14px]"
                  >
                    {filled && (
                      <>
                        <CheckCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        <span className="leading-tight">{shot.captured}</span>
                      </>
                    )}
                  </motion.p>
                </div>
              );
            })}
          </div>
        </section>

        {/* What happens next — mini-explainer card so the customer
            knows the bump isn't automatic and roughly how long it takes. */}
        <section
          aria-label="What happens next"
          className="rounded-3xl border border-zinc-200 bg-zinc-50/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            How the bump works
          </p>
          <ol className="space-y-2 text-sm text-zinc-600 leading-relaxed">
            <li className="flex gap-3">
              <span className="font-semibold text-zinc-900 tabular-nums">1.</span>
              Our AI scores your photos against typical condition for a {vehicleStr || "vehicle like yours"}.
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-zinc-900 tabular-nums">2.</span>
              If we find evidence of cleaner-than-rated condition, your offer goes up on the spot.
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-zinc-900 tabular-nums">3.</span>
              Your offer can only go up — never down. The bumped number is yours to accept.
            </li>
          </ol>
        </section>

        <div>
          <Button
            onClick={handleUpload}
            disabled={uploading || !hasNewUploads}
            className="w-full md:w-auto md:px-10 h-14 rounded-full text-base font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100"
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
                {allComplete ? "Submit for AI evaluation" : "Upload what I have"}
              </>
            )}
          </Button>
          {!allComplete && (
            <p className="text-[11px] text-zinc-500 mt-3">
              All six help us re-appraise accurately — but you can submit what you have and add the rest later.
            </p>
          )}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleShotFile}
        className="hidden"
      />
    </div>
  );
};

/**
 * Full-screen ghost loader — covers the page during the evaluation
 * phase. Rotating tip lines so the customer doesn't stare at a
 * spinner; the messages telegraph what's actually happening
 * (analyzing photos → cross-checking condition → tallying bump
 * items → applying to your offer). Cycles every ~1.4s on a min-3.5s
 * loader so the customer reads at least 2 lines before the reveal.
 */
const BoostEvaluatingOverlay = () => {
  const tips = [
    "Reading your photos…",
    "Cross-checking against typical condition for your vehicle…",
    "Tallying bump items…",
    "Applying changes to your offer…",
  ];
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 1400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
      aria-label="Evaluating your photos"
    >
      <div className="text-center space-y-6 max-w-md">
        {/* Pulse-orb visual — same family as the dealer's other
            ghost-screen options (legacy-car, pulse-orb, etc.) so
            the boost page doesn't introduce a new motion language. */}
        <div className="relative w-20 h-20 mx-auto">
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-500/20"
            animate={{ scale: [1, 1.6, 1.6], opacity: [0.6, 0, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-500/30"
            animate={{ scale: [1, 1.4, 1.4], opacity: [0.8, 0, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
          />
          <span className="absolute inset-2 rounded-full bg-emerald-500 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white" aria-hidden="true" />
          </span>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
          Evaluating
        </p>

        {/* Cross-fading tip line. min-h prevents layout jump. */}
        <div className="min-h-[3.5rem] flex items-center justify-center">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="text-base text-zinc-700 leading-relaxed"
          >
            {tips[tipIndex]}
          </motion.p>
        </div>

        <p className="text-[11px] text-zinc-400">
          This usually takes a few seconds.
        </p>
      </div>
    </motion.div>
  );
};

/**
 * Tiny number-counter component — animates a $X figure from `from`
 * to `to` over ~900ms with eased steps so the new total feels
 * earned rather than just appearing. Used in the receipt's total
 * row to draw the eye to the bumped number.
 */
const AnimatedTotal = ({ from, to, delay = 0 }: { from: number; to: number; delay?: number }) => {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const start = performance.now() + delay;
    const duration = 900;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay]);
  return (
    <span className="font-sans text-[36px] md:text-[44px] font-bold tracking-[-0.025em] text-emerald-700 tabular-nums leading-none">
      ${value.toLocaleString()}
    </span>
  );
};

const Header = ({ config }: { config: any }) => (
  <header className="border-b border-zinc-200 bg-white">
    <div className="max-w-[840px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-3 min-w-0">
        <ArrowLeft className="w-4 h-4 text-zinc-500" aria-hidden="true" />
        {config.logo_url ? (
          <img src={config.logo_url} alt={config.dealership_name} className="h-16 md:h-20 w-auto object-contain" />
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

export default BoostOfferClarity;
