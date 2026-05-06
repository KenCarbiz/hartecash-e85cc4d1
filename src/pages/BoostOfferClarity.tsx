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
  { id: "exterior_front",    label: "Front" },
  { id: "exterior_driver",   label: "Driver Side" },
  { id: "exterior_rear",     label: "Rear" },
  { id: "exterior_passenger",label: "Passenger Side" },
  { id: "dashboard_odometer",label: "Odometer" },
  { id: "tires_wheels",      label: "Tire & Wheel" },
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

  const handleUpload = async () => {
    if (!submission || !hasNewUploads) return;
    setUploading(true);
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
            Photos received
          </p>
          <h1 className="font-sans text-[36px] md:text-[48px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
            We're reviewing now.
          </h1>
          <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
            Our AI is analyzing your photos and an appraiser will follow up within{" "}
            <span className="font-semibold text-zinc-900">24 hours</span>. If your vehicle is in better
            condition than rated, we'll bump your offer and text you the new amount.
          </p>
          <Button
            onClick={() => navigate(`/my-submission/${token}`)}
            className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100 font-semibold"
          >
            Back to my submission <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        </main>
      </div>
    );
  }

  if (!submission) return null;

  const vehicleStr = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");
  const modelStr = [submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");

  return (
    <div className="min-h-screen bg-white text-zinc-900">
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

          {/* Trust strip — three slim chips, one line. Sets the
              dealer's process expectations without burying the lede. */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-600 pt-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              AI scores instantly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Appraiser confirms within 24 h
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {REQUIRED_SHOTS.map((shot) => {
              const state = shotState[shot.id];
              const filled = state?.file || state?.uploaded;
              return (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => handleTileClick(shot.id)}
                  className={`relative aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all text-left ${
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
              An appraiser confirms within 24 hours.
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-zinc-900 tabular-nums">3.</span>
              If your vehicle is in better condition than rated, we'll text you the new offer — your old offer never goes down.
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
                {allComplete ? "Submit for review" : "Upload what I have"}
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
