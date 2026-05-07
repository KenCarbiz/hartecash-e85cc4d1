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
import CaptureWithOverlay from "@/components/sell-form/CaptureWithOverlay";

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
  // Fallback price fields the offer page reads from when
  // offered_price is null. Carrying them here so the boost-page
  // hero shows the same number the customer just saw on /offer
  // (and so the floor-locked chip / receipt arithmetic line up).
  estimated_offer_high?: number | null;
  bb_tradein_avg?: number | null;
  bb_wholesale_avg?: number | null;
  mileage?: string | null;
  overall_condition?: string | null;
}

const REQUIRED_SHOTS = [
  { id: "exterior_front",    label: "Front",          captured: "Front exterior captured",    tip: "Whole front in frame" },
  { id: "exterior_driver",   label: "Driver Side",    captured: "Driver side angle clear",    tip: "Whole side, daylight if you can" },
  { id: "exterior_rear",     label: "Rear",           captured: "Rear exterior captured",     tip: "Stand back so the whole rear fits" },
  { id: "exterior_passenger",label: "Passenger Side", captured: "Passenger side angle clear", tip: "Whole side, daylight if you can" },
  // Engine-on tip is intentionally vague — we don't tell the
  // customer why (the AI uses a running engine to capture live
  // warning lights vs. pre-start indicators), but the instruction
  // is non-negotiable for the no_warning_lights signal to fire
  // accurately.
  { id: "dashboard_odometer",label: "Odometer",       captured: "Odometer reading visible",   tip: "Engine running, photo from the driver seat" },
  { id: "tires_wheels",      label: "Tire & Wheel",   captured: "Tire wear pattern visible",  tip: "Get close — show the tread groove" },
];

// Optional bonus shots — the AI uses these to cross-reference
// odometer OCR against actual interior wear. Heavily-worn driver
// seats and shiny worn steering-wheel grips are the strongest
// "true miles higher than odometer says" tells in the appraisal
// industry. Keeping these clean = bigger bump.
//
// Bonus shots don't gate Submit — allComplete is calculated only
// against REQUIRED_SHOTS so a customer can submit with 6 of 6
// required + 0 of 2 bonus and still get their core bump. The
// extra ~$200 chip per shot is the carrot for the engaged ones.
const BONUS_SHOTS = [
  {
    id: "interior_driver_seat",
    label: "Driver Seat",
    captured: "Driver seat captured",
    tip: "Whole seat from the door, daylight if you can",
    rewardHint: "+ up to $200 if seat looks low-wear",
  },
  {
    id: "interior_steering_wheel",
    label: "Steering Wheel",
    captured: "Steering wheel captured",
    tip: "Straight on from the driver seat",
    rewardHint: "+ up to $150 if wheel looks original",
  },
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

  // Tile-tap behavior — opens the CarMax-style overlay camera by
  // setting activeShot. The CaptureWithOverlay component (rendered
  // conditionally below) requests getUserMedia and shows the
  // silhouette guide. If the customer hits "Choose from library"
  // or the camera isn't available, we fall through to the native
  // file picker via fileInputRef.
  const handleTileClick = (shotId: string) => {
    setActiveShot(shotId);
  };

  // Common path for any captured image — both camera capture and
  // native picker funnel through here so the preview / state /
  // size validation logic lives in one place.
  const acceptCapturedFile = (file: File) => {
    if (!activeShot) return;
    if (!file.type.startsWith("image/")) {
      setError("That doesn't look like an image. Please try again.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds 10MB limit.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setShotState((prev) => ({
        ...prev,
        [activeShot]: { file, preview: ev.target?.result as string },
      }));
    };
    reader.readAsDataURL(file);
    setActiveShot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleShotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptCapturedFile(file);
  };

  // Library fallback — fires when the camera modal can't get a
  // stream OR when the customer explicitly taps the library icon.
  // Triggers the existing hidden <input type="file"> so the OS
  // photo picker opens. activeShot stays set; acceptCapturedFile
  // runs on selection.
  const triggerLibraryFallback = () => {
    fileInputRef.current?.click();
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
        // Intentionally NOT calling mark_photos_uploaded here.
        // That RPC promotes the submission's next_step into a
        // "photos done" state, which makes get_submission_portal
        // exclude the row → after the boost the customer would
        // bounce back to /offer/:token and see "Offer Not Available"
        // because the portal RPC stopped returning their submission.
        // The boost flow uses storage + offer_bumps audit to track
        // photos; the legacy "photos_uploaded" flag is for the
        // separate /upload/:token path and shouldn't fire here.
        if (submission.id) {
          // Notify the dealer that a boost was triggered so the
          // appraiser queue picks it up promptly.
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

      // analyze-vehicle-damage is now invoked by boost-evaluate
      // server-side instead of fired-and-forgotten from the
      // browser. Single source of truth + the orchestrator can
      // wait for results before computing bumps. The block below
      // is intentionally empty for now to keep the surrounding
      // try/catch intact during the migration.
      if (submission.id) {
        for (const [shotId, val] of Object.entries(shotState)) {
          if (!val.file) continue;
          const matched = allFiles?.find((f) => f.name.startsWith(`${shotId}-`));
          if (matched) {
            // Intentionally no-op — boost-evaluate handles this.
            void shotId;
          }
        }
      }

      // ── Evaluation phase ─────────────────────────────────────
      // Hand the uploaded photo paths to boost-evaluate which:
      //   1. runs Gemini 2.5 Flash vision per photo (writes to
      //      damage_reports for the appraiser queue)
      //   2. OCRs the odometer and re-calls bb-lookup with
      //      verified miles for a fresh organic baseline
      //   3. composes AI bumps on top of the new baseline
      //   4. persists offered_price + audits in offer_bumps
      // The deterministic client-side receipt is gone — the receipt
      // shown on the next screen comes straight from the AI run.
      setPhase("evaluating");

      // Bundle every shot — required + bonus — that the customer
      // actually uploaded. boost-evaluate runs vision per path and
      // tolerates absent bonus shots gracefully (just skips those
      // signals instead of penalizing).
      const photoPaths: Record<string, string> = {};
      for (const shot of [...REQUIRED_SHOTS, ...BONUS_SHOTS]) {
        const matched = allFiles?.find((f) => f.name.startsWith(`${shot.id}-`));
        if (matched) photoPaths[shot.id] = `${token}/${matched.name}`;
      }

      // Minimum 3.5s loader — gives Gemini calls time to land + the
      // customer reads at least 2 cycling tip lines before the reveal.
      // boost-evaluate itself can take 8–15s under load, so we wait
      // for it; the loader's min duration just prevents a flash for
      // unusually fast runs (cached photos, etc.).
      const minLoader = new Promise((r) => setTimeout(r, 3500));
      const evalCall = supabase.functions.invoke("boost-evaluate", {
        body: { token, photo_paths: photoPaths },
      });
      const [, evalRes] = await Promise.all([minLoader, evalCall]);

      const evalData = (evalRes as { data?: Record<string, unknown> }).data || {};
      const previousOffer = Number(evalData.previous_offer) || 0;
      const newOffer = Number(evalData.new_offer) || previousOffer;
      const bumpAmount = Number(evalData.bump_amount) || 0;
      const lineItems = (evalData.line_items as Array<{ label: string; amount: number; source: string }>) || [];

      setBumpResult({
        previousOffer,
        newOffer,
        bumpAmount,
        lineItems,
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
    // Concrete date for the trust chip — "Locked through May 14"
    // out-trusts a generic "Locked for 8 days" because dates are
    // verifiable. Bound to the dealer's actual guarantee window so
    // it can't drift from the real expiry. Defaults to 8 days when
    // the dealer hasn't set a value.
    const lockDays = Number(config.price_guarantee_days) || 8;
    const lockEnd = new Date();
    lockEnd.setDate(lockEnd.getDate() + lockDays);
    const lockEndsLabel = lockEnd.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return (
      <div className="min-h-screen bg-white text-zinc-900">
        <Header config={config} />
        {/* min-h reserves vertical space during the line-item
            stagger + count-up animation so the demoted Save link
            and trust chips don't shift the page underneath the
            customer's finger as they animate in. CLS prevention
            on the highest-conversion screen. */}
        <main className="max-w-[640px] mx-auto px-5 md:px-8 py-12 md:py-16 space-y-8 min-h-[640px]">
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
            className="space-y-4 text-center"
          >
            {/* Single dominant Accept CTA. Save demoted to a text
                link below so the customer's choice has a clear
                primary instead of two equal-weight pills. */}
            <Button
              onClick={() => navigate(`/deal/${token}`)}
              className="w-full sm:w-auto sm:min-w-[280px] rounded-full px-8 h-14 text-base bg-zinc-900 hover:bg-zinc-800 text-white font-semibold transition-[filter,background] duration-150 hover:brightness-95 shadow-[0_4px_14px_rgba(0,0,0,0.15)]"
              style={
                config.landing_cta_color
                  ? { background: config.landing_cta_color, color: config.landing_cta_text_color || "#ffffff" }
                  : undefined
              }
            >
              Accept ${bumpResult.newOffer.toLocaleString()}
              <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>

            {/* Trust chips — sit directly under Accept so they
                catch the customer at the click moment. Semantic
                <ul> with separator <li>s so screen readers parse
                three items, not one middot-string blob. Date is
                bound to the dealer's price-guarantee window so
                it's never out of sync with the actual lock. */}
            <ul
              role="list"
              className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 leading-tight"
            >
              <li className="inline-flex items-center">Locked through {lockEndsLabel}</li>
              <li aria-hidden="true" className="text-zinc-300">·</li>
              <li className="inline-flex items-center">
                Backed by {config.dealership_name || "the dealer"}
              </li>
              <li aria-hidden="true" className="text-zinc-300">·</li>
              <li className="inline-flex items-center">One firm offer</li>
            </ul>

            {/* Save → text link, not a pill button. Same
                navigation; visual demotion only. */}
            <button
              type="button"
              onClick={() => navigate(`/offer/${token}`)}
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded"
            >
              Save this offer for later →
            </button>

            {/* Final-inspection footer — reframed so it reinforces
                the floor-locked promise instead of quietly
                retracting it. Same legal cover, opposite tone. */}
            <p className="text-[11px] text-zinc-400 max-w-md mx-auto leading-relaxed pt-2">
              Final number confirmed at drop-off — your floor holds either way.
            </p>
          </motion.div>
        </main>
      </div>
    );
  }

  if (!submission) return null;

  const vehicleStr = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");
  const modelStr = [submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");

  // Effective offer — the same fallback chain the offer page uses.
  // offered_price wins when present; otherwise we read whichever
  // appraisal field actually held the customer-facing number. Used
  // for both the personalized hero ("Push your $X higher") and the
  // floor-locked chip so they always match what the customer saw
  // on /offer when they clicked Save.
  const effectiveOffer =
    Number(submission.offered_price) ||
    Number(submission.estimated_offer_high) ||
    Number(submission.bb_tradein_avg) ||
    Number(submission.bb_wholesale_avg) ||
    0;

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
            {effectiveOffer > 0
              ? `Push your $${effectiveOffer.toLocaleString()} higher.`
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
              AI inspects every panel, dash, and tire — then scores it
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Backed by a real appraiser
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Floor locked
              {effectiveOffer > 0 ? ` at $${effectiveOffer.toLocaleString()}` : ""}
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
            {/* Phone-with-camera glyph + QR — the icon takes the
                "what do I do with this thing?" friction off the QR.
                Sibling layout (no absolute overlay → no CLS),
                aria-hidden so the QR keeps its label. */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <svg
                width="24"
                height="32"
                viewBox="0 0 24 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-700"
                aria-hidden="true"
              >
                <rect x="3" y="2" width="18" height="28" rx="3" />
                <circle cx="12" cy="11" r="2.5" />
                <path d="M9 8h-1.5M16.5 8H15" />
                <line x1="10" y1="26" x2="14" y2="26" />
              </svg>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-200">
                <QRCodeSVG value={`${window.location.origin}/boost-offer/${token}`} size={120} level="H" />
              </div>
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-500 px-3 text-center">
                        <Camera className="w-5 h-5" aria-hidden="true" />
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          {shot.label}
                        </span>
                        {/* Per-shot capture tip — sets up the right
                            shot before the camera opens so we don't
                            burn AI cycles on a blurry front-too-close
                            or an engine-off odometer (which would
                            miss the warning-light pass). */}
                        {shot.tip && (
                          <span className="text-[10px] font-medium text-zinc-400 leading-snug">
                            {shot.tip}
                          </span>
                        )}
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

        {/* ── Bonus shots ── Optional driver seat + steering wheel.
              These are the strongest interior signals for "is the
              odometer telling the truth" — clean seat bolsters and
              an unworn wheel grip suggest the miles are real. We
              don't gate Submit on them; they're an extra-credit
              opportunity for engaged customers. */}
        <section aria-label="Bonus photos" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Bonus — extra value
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Optional
            </p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed -mt-2">
            Two more photos worth your time — the AI uses them to confirm your{" "}
            {modelStr || "vehicle"} has been well cared for. Each can add to your offer.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BONUS_SHOTS.map((shot) => {
              const state = shotState[shot.id];
              const filled = state?.file || state?.uploaded;
              return (
                <div key={shot.id} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleTileClick(shot.id)}
                    className={`relative aspect-[4/3] w-full rounded-2xl overflow-hidden border-2 transition-all text-left ${
                      filled
                        ? "border-emerald-500"
                        : "border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    }`}
                  >
                    {state?.preview ? (
                      <img src={state.preview} alt={shot.label} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center text-zinc-600">
                        <Sparkles className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          {shot.label}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-700 leading-snug">
                          {shot.rewardHint}
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
                      {filled ? "Tap to retake" : shot.tip}
                    </span>
                  </button>
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

      {/* CarMax-style overlay capture. Mounts only when activeShot
          is set (after a tile-tap) so we don't request camera
          permission on page load. The component handles its own
          stream lifecycle — every exit path stops the tracks. */}
      {activeShot && (() => {
        // Required + bonus both go through the same camera modal —
        // look in either list so bonus tile-taps work identically.
        const shotDef =
          REQUIRED_SHOTS.find((s) => s.id === activeShot) ||
          BONUS_SHOTS.find((s) => s.id === activeShot);
        if (!shotDef) return null;
        return (
          <CaptureWithOverlay
            shotKey={shotDef.id}
            shotLabel={shotDef.label}
            tip={shotDef.tip}
            onCapture={(file) => acceptCapturedFile(file)}
            onFallback={triggerLibraryFallback}
            onCancel={() => setActiveShot(null)}
          />
        );
      })()}
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
    let hapticFired = false;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      // Single haptic tick at the start of the count-up — the
      // moment of delight on this page. navigator.vibrate is
      // ignored on iOS Safari (graceful), fires on Android. Only
      // happens when a real bump occurred (to > from).
      if (!hapticFired && t > 0 && to > from) {
        hapticFired = true;
        try {
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(15);
          }
        } catch { /* noop — some embedded browsers throw */ }
      }
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
