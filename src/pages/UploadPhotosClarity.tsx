import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, CheckCircle, Loader2, Plus, Smartphone, Upload, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { usePhotoConfig } from "@/hooks/usePhotoConfig";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Clarity-tier photo upload page — Apple-minimal companion to the
 * other Clarity customer-journey pages. Mounted by UploadPhotos.tsx
 * as a top-level dispatch when landing_template === "clarity".
 *
 * Scope of this scaffold:
 *   - Quiet white header + bold "Add photos of your vehicle" hero
 *   - Required-shot tiles in a clean grid; each tile opens the
 *     native file picker (mobile triggers the camera via capture
 *     attribute — no separate camera component yet)
 *   - Optional "extra photos" multi-select strip beneath the
 *     required grid
 *   - Submit uploads to the existing submission-photos bucket and
 *     fires the same mark_photos_uploaded RPC + analyze-vehicle-damage
 *     edge fn as the legacy page so dealer alerts are unchanged
 *   - Done state with a "View my submission" link
 *
 * Not yet ported (to layer in later turns): VehicleCameraCapture
 * with the silhouette overlay, GhostScreen sync indicator,
 * MobileQRBanner, PhotoGuide tips dialog. The legacy upload page
 * still ships with all of these for any non-Clarity template.
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
}

type ShotState = { file?: File; preview?: string; uploaded?: boolean };

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const UploadPhotosClarity = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const isMobile = useIsMobile();

  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shotState, setShotState] = useState<Record<string, ShotState>>({});
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [activeShot, setActiveShot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

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

  const dealershipId = submission?.dealership_id || "default";
  const { requiredShots, optionalShots, enabledShots, loading: configLoading } = usePhotoConfig(dealershipId);

  // Pre-populate already-uploaded shots so the customer sees what's done.
  useEffect(() => {
    if (!token || !submission || !enabledShots.length) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 100 });
      if (cancelled || !data) return;
      const existing: Record<string, ShotState> = {};
      for (const shot of enabledShots) {
        const match = data.find((f) => f.name.startsWith(`${shot.shot_id}-`));
        if (match) {
          const { data: urlData } = supabase.storage
            .from("submission-photos")
            .getPublicUrl(`${token}/${match.name}`);
          existing[shot.shot_id] = { uploaded: true, preview: urlData.publicUrl };
        }
      }
      setShotState(existing);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, submission, enabledShots]);

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

  const addExtraFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const added = Array.from(fileList).filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > MAX_FILE_SIZE) {
        setError(`"${f.name}" exceeds 10MB.`);
        return false;
      }
      return true;
    });
    setExtraFiles((prev) => [...prev, ...added]);
    added.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setExtraPreviews((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeExtra = (i: number) => {
    setExtraFiles((prev) => prev.filter((_, idx) => idx !== i));
    setExtraPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const requiredComplete = requiredShots.every(
    (s) => shotState[s.shot_id]?.file || shotState[s.shot_id]?.uploaded,
  );
  const hasNewUploads = Object.values(shotState).some((v) => v.file) || extraFiles.length > 0;

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
      for (const file of extraFiles) {
        const ext = file.name.split(".").pop();
        const path = `${token}/extra-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
      }

      const { data: allFiles } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 100 });
      const allRequiredPresent = requiredShots.every((s) =>
        allFiles?.some((f) => f.name.startsWith(`${s.shot_id}-`)),
      );
      if (allRequiredPresent && token) {
        await supabase.rpc("mark_photos_uploaded", { _token: token });
        if (submission?.id) {
          safeInvoke("send-notification", {
            body: { trigger_key: "photos_uploaded", submission_id: submission.id },
            context: { from: "UploadPhotosClarity.submit" },
          });
        }
      }

      // Fire AI damage analysis per uploaded shot, same pattern as legacy.
      if (submission?.id) {
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
              },
              context: { from: "UploadPhotosClarity.analyze", category: shotId },
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

  if (loading || configLoading) {
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Photos uploaded</p>
          <h1 className="font-sans text-[36px] md:text-[48px] font-bold tracking-[-0.025em] leading-[1.04] text-zinc-900">
            Thanks — got 'em.
          </h1>
          <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
            Our appraiser will review them and may bump your offer if condition is better than rated.
          </p>
          <Button
            onClick={() => navigate(`/my-submission/${token}`)}
            className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white transition-[filter,background] duration-150 hover:brightness-95 disabled:opacity-75 disabled:brightness-100 font-semibold"
          >
            View my submission <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        </main>
      </div>
    );
  }

  if (!submission) return null;

  const vehicleStr = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");
  const completedCount = requiredShots.filter((s) => shotState[s.shot_id]?.file || shotState[s.shot_id]?.uploaded).length;

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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Photos</p>
          <h1 className="font-sans text-[32px] md:text-[44px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
            Add photos of your {vehicleStr || "vehicle"}
          </h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Clean shots in good light help us finalize your offer faster — and may bump it up.
          </p>
        </motion.section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Mobile QR — desktop-only nudge to continue from a phone
            so the customer can use the rear camera. Auto-hides on
            mobile (no point showing a QR to the device reading it). */}
        {!isMobile && token && (
          <section
            aria-label="Continue on your phone"
            className="rounded-3xl border border-zinc-200 bg-zinc-50/40 p-6 flex items-center gap-6"
          >
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-200">
              <QRCodeSVG value={`${window.location.origin}/upload/${token}`} size={120} level="H" />
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
                href={`${window.location.origin}/upload/${token}`}
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

        {/* Required shots grid */}
        <section aria-label="Required photos" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Required ({completedCount}/{requiredShots.length})
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {requiredShots.map((shot) => {
              const state = shotState[shot.shot_id];
              const filled = state?.file || state?.uploaded;
              return (
                <button
                  key={shot.shot_id}
                  type="button"
                  onClick={() => handleTileClick(shot.shot_id)}
                  className={`relative aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all text-left ${
                    filled ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-zinc-50/40"
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
                        removeShot(shot.shot_id);
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

        {/* Extra photos */}
        <section aria-label="Extra photos" className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Extra (optional)
          </p>
          <div className="flex flex-wrap gap-3">
            {extraPreviews.map((preview, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-200">
                <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExtra(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-zinc-900/80 text-white flex items-center justify-center"
                  aria-label="Remove extra photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => extraInputRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-200 hover:border-zinc-400 transition-colors flex flex-col items-center justify-center gap-1 text-zinc-500"
              aria-label="Add extra photos"
            >
              <Plus className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Add</span>
            </button>
          </div>
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
                {requiredComplete ? "Submit photos" : "Upload what I have"}
              </>
            )}
          </Button>
          {!requiredComplete && (
            <p className="text-[11px] text-zinc-500 mt-3">
              Required shots not yet complete — you can still submit and add the rest later.
            </p>
          )}
        </div>
      </main>

      {/* Hidden inputs — one for required-shot file picks, one for extras. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleShotFile}
        className="hidden"
      />
      <input
        ref={extraInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => addExtraFiles(e.target.files)}
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
          <img src={config.logo_url} alt={config.dealership_name} className="h-12 md:h-14 w-auto object-contain" />
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

export default UploadPhotosClarity;
