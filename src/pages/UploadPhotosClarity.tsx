import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle,
  Copy,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { usePhotoConfig } from "@/hooks/usePhotoConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVehicleImage } from "@/hooks/useVehicleImage";
import { parsePhotoExif, savePhotoMetadata, type PhotoExifResult } from "@/lib/photoExif";
import PhotoTrustBadge from "@/components/upload/PhotoTrustBadge";

/**
 * Clarity-tier photo upload page — the guided "Add Photos" task screen
 * that follows the AI-appraisal popup. Three-column layout on desktop:
 *
 *   [ Left progress rail ] [ Center task card ] [ Right vehicle summary ]
 *
 * The center card is the action surface (progress header, phone handoff
 * module, required + optional tiles, dynamic CTA, reassurance). The page
 * intentionally does NOT repeat the AI value pitch — that lives in the
 * popup. Tiles only flip to "verified" after a real upload completes;
 * no fake scanning animations.
 */

interface SubmissionInfo {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin?: string | null;
  name: string | null;
  photos_uploaded: boolean;
  bb_class_name?: string | null;
  dealership_id?: string;
  mileage?: string | null;
  offered_price?: number | null;
  phone?: string | null;
}

type TileStatus = "empty" | "selected" | "uploading" | "uploaded" | "rejected";

interface ShotState {
  file?: File;
  preview?: string;
  uploaded?: boolean;
  status: TileStatus;
  rejectReason?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatMoney = (n?: number | null) =>
  typeof n === "number" && n > 0
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";

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
  const [shotExif, setShotExif] = useState<Record<string, PhotoExifResult>>({});
  const [extraExif, setExtraExif] = useState<Record<number, PhotoExifResult>>({});
  const [expectedCoords, setExpectedCoords] = useState<{ lat: number | null; lng: number | null; source?: string } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Fetch submission with offer + mileage via the portal RPC so the
  // right-rail summary can show the customer's locked firm offer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Invalid link.");
        setLoading(false);
        return;
      }
      const { data, error: rpcErr } = await supabase.rpc("get_submission_portal", { _token: token });
      if (cancelled) return;
      if (rpcErr || !data || (data as unknown[]).length === 0) {
        // Fallback to the lighter RPC if portal lookup fails.
        const fb = await supabase.rpc("get_submission_by_token", { _token: token });
        if (fb.error || !fb.data || (fb.data as unknown[]).length === 0) {
          setError("Submission not found.");
          setLoading(false);
          return;
        }
        setSubmission((fb.data as SubmissionInfo[])[0]);
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

  const vehicleImage = useVehicleImage(
    submission?.vehicle_year,
    submission?.vehicle_make,
    submission?.vehicle_model,
    submission?.vin,
    token,
  );

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
          existing[shot.shot_id] = { uploaded: true, preview: urlData.publicUrl, status: "uploaded" };
        }
      }
      setShotState(existing);
    })();
    return () => { cancelled = true; };
  }, [token, submission, enabledShots]);

  // Resolve customer's expected location for photo GPS comparison.
  useEffect(() => {
    if (!submission) return;
    let cancelled = false;
    (async () => {
      const sub = submission as SubmissionInfo & { store_location_id?: string | null };
      let query = supabase
        .from("dealership_locations" as never)
        .select("center_lat,center_lng,name")
        .eq("is_active", true)
        .limit(1);
      if (sub.store_location_id) {
        query = supabase
          .from("dealership_locations" as never)
          .select("center_lat,center_lng,name")
          .eq("id", sub.store_location_id)
          .limit(1);
      } else if (sub.dealership_id) {
        query = supabase
          .from("dealership_locations" as never)
          .select("center_lat,center_lng,name")
          .eq("dealership_id", sub.dealership_id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(1);
      }
      const { data } = await query;
      if (cancelled || !data || data.length === 0) return;
      const row = (data as unknown as Array<{ center_lat: number | null; center_lng: number | null; name: string | null }>)[0];
      if (row.center_lat != null && row.center_lng != null) {
        setExpectedCoords({ lat: row.center_lat, lng: row.center_lng, source: `Rooftop: ${row.name || "store"}` });
      }
    })();
    return () => { cancelled = true; };
  }, [submission]);

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
    const shotId = activeShot;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setShotState((prev) => ({
        ...prev,
        [shotId]: { file, preview: ev.target?.result as string, status: "selected" },
      }));
    };
    reader.readAsDataURL(file);
    parsePhotoExif(file, expectedCoords).then((exif) => {
      setShotExif((prev) => ({ ...prev, [shotId]: exif }));
    }).catch((err) => console.warn("[UploadPhotosClarity] EXIF parse failed:", err));
    setActiveShot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeShot = (shotId: string) => {
    setShotState((prev) => {
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
    setShotExif((prev) => {
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
    const baseIdx = extraFiles.length;
    setExtraFiles((prev) => [...prev, ...added]);
    added.forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = (e) => setExtraPreviews((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
      parsePhotoExif(f, expectedCoords).then((exif) => {
        setExtraExif((prev) => ({ ...prev, [baseIdx + i]: exif }));
      }).catch((err) => console.warn("[UploadPhotosClarity] EXIF parse failed:", err));
    });
  };

  const removeExtra = (i: number) => {
    setExtraFiles((prev) => prev.filter((_, idx) => idx !== i));
    setExtraPreviews((prev) => prev.filter((_, idx) => idx !== i));
    setExtraExif((prev) => {
      const next: Record<number, PhotoExifResult> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const idx = Number(k);
        if (idx < i) next[idx] = v;
        else if (idx > i) next[idx - 1] = v;
      });
      return next;
    });
  };

  const completedCount = useMemo(
    () => requiredShots.filter((s) => shotState[s.shot_id]?.file || shotState[s.shot_id]?.uploaded).length,
    [requiredShots, shotState],
  );
  const remaining = Math.max(0, requiredShots.length - completedCount);
  const requiredComplete = remaining === 0 && requiredShots.length > 0;
  const hasNewUploads = Object.values(shotState).some((v) => v.file) || extraFiles.length > 0;

  const secureLink = token ? `${window.location.origin}/upload/${token}` : "";

  const handleCopyLink = async () => {
    if (!secureLink) return;
    try {
      await navigator.clipboard.writeText(secureLink);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setError("Couldn't copy — long-press the link to copy manually.");
    }
  };

  const handleTextMeLink = () => {
    if (!secureLink) return;
    // Opens the native SMS composer pre-filled with the secure link.
    // No fake "we sent it!" state — the customer's own messages app
    // is the source of truth.
    const body = encodeURIComponent(`Continue your vehicle photos here: ${secureLink}`);
    window.location.href = `sms:?&body=${body}`;
  };

  const handleUpload = async () => {
    if (!submission || !hasNewUploads) return;
    setUploading(true);
    setError("");
    // Flip each selected tile into "uploading" so the customer sees
    // honest state. Tiles that are already uploaded stay uploaded.
    setShotState((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(prev)) {
        if (v.file) next[k] = { ...v, status: "uploading" };
      }
      return next;
    });
    try {
      const uploadedPaths: Array<{ path: string; shotId: string | null; exif: PhotoExifResult | null }> = [];
      for (const [shotId, val] of Object.entries(shotState)) {
        if (!val.file) continue;
        const ext = val.file.name.split(".").pop();
        const path = `${token}/${shotId}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, val.file, { contentType: val.file.type, upsert: false });
        if (uploadErr) throw uploadErr;
        uploadedPaths.push({ path, shotId, exif: shotExif[shotId] || null });
        setShotState((prev) => ({ ...prev, [shotId]: { ...prev[shotId], status: "uploaded", uploaded: true } }));
      }
      for (let i = 0; i < extraFiles.length; i++) {
        const file = extraFiles[i];
        const ext = file.name.split(".").pop();
        const path = `${token}/extra-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
        uploadedPaths.push({ path, shotId: null, exif: extraExif[i] || null });
      }

      if (submission?.id) {
        for (const item of uploadedPaths) {
          if (!item.exif) continue;
          savePhotoMetadata({
            submissionId: submission.id,
            submissionToken: token || null,
            storagePath: item.path,
            photoCategory: item.shotId,
            expected: expectedCoords,
            exif: item.exif,
          });
        }
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
      // Roll any uploading tiles back to "selected" so the user can retry.
      setShotState((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(prev)) {
          if (v.status === "uploading") next[k] = { ...v, status: "selected" };
        }
        return next;
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" aria-hidden="true" />
      </div>
    );
  }

  if (error && !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900 px-6">
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
    // Hand the customer off to the AI analysis screen. The portal
    // routes "photos_uploaded" submissions into an analysis view; we
    // navigate there so the customer sees thumbnails + rotating
    // statuses, not another success page that resets to zero.
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900">
        <Header config={config} token={token} />
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Photos submitted</p>
          <h1 className="font-sans text-[32px] md:text-[40px] font-bold tracking-[-0.025em] leading-[1.05] text-zinc-900">
            Photos are in. Starting AI review now.
          </h1>
          <p className="text-base text-zinc-500 max-w-md mx-auto leading-relaxed">
            Your current offer stays available while we review. We'll let you know if it bumps up.
          </p>
          <Button
            onClick={() => navigate(`/my-submission/${token}`)}
            className="rounded-full px-6 h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
          >
            See AI review <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        </main>
      </div>
    );
  }

  if (!submission) return null;

  const vehicleStr = [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model].filter(Boolean).join(" ");

  // Bottom CTA copy adapts to remaining photos so the customer always
  // knows exactly what's blocking submit.
  let ctaLabel: string;
  if (requiredComplete) ctaLabel = "Submit Photos for AI Review";
  else if (remaining === requiredShots.length) ctaLabel = `Add ${requiredShots.length} required photos to continue`;
  else if (remaining === 1) ctaLabel = "Add 1 more required photo";
  else ctaLabel = `Add ${remaining} more required photos`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Header config={config} token={token} />

      <main className="max-w-[1180px] mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
          {/* LEFT — progress rail */}
          <aside className="hidden lg:block lg:col-span-3">
            <ProgressRail />
          </aside>

          {/* CENTER — guided task card */}
          <section className="lg:col-span-6 space-y-5">
            {/* AI appraisal hero — the entry point into the photo task.
                Replaces the prior page-level headline so the customer
                hits an energized, exciting hero instead of a redundant
                "Add a few quick photos" title. */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-white p-5 md:p-6 shadow-[0_6px_30px_-12px_rgba(124,58,237,0.35)]"
            >
              {/* Soft purple gradient/glow */}
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(139,92,246,0.18),transparent_60%),radial-gradient(100%_80%_at_100%_100%,rgba(192,132,252,0.16),transparent_60%)]" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-[0.16em] px-2.5 py-1">
                  <Sparkles className="w-3 h-3" /> AI Photo Appraisal
                </div>
                <h1 className="mt-3 font-sans text-[24px] md:text-[28px] font-bold tracking-[-0.02em] leading-[1.15] text-zinc-900">
                  Add photos to check for a better offer.
                </h1>
                <p className="mt-2 text-[14px] md:text-[15px] text-zinc-600 leading-relaxed max-w-xl">
                  Our AI agent reviews your vehicle photos for condition, options, and market signals that may improve your offer.
                </p>

                {/* Mint green value callout */}
                <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200/80 px-4 py-3 flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-emerald-200 text-emerald-600 shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Average uplift</p>
                    <p className="text-[15px] md:text-[16px] font-bold text-emerald-900 leading-tight mt-0.5">
                      $250 – $2,375 <span className="font-semibold text-emerald-700">after photo review</span>
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[12px] text-zinc-500 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Your current offer remains available. No obligation.
                </p>
              </div>
            </motion.div>


            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Progress header */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-semibold text-zinc-900">
                  {completedCount} of {requiredShots.length} required photos added
                </p>
                {requiredComplete && (
                  <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Ready to submit
                  </span>
                )}
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-600 rounded-full transition-all duration-500"
                  style={{ width: `${requiredShots.length ? (completedCount / requiredShots.length) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-3 text-[12px] text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Takes about 2 minutes</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Secure upload</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Current offer protected</span>
              </p>
            </div>

            {/* Phone handoff (desktop) / Camera ready (mobile) */}
            {!isMobile ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-violet-200 text-violet-700 shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-zinc-900 leading-tight">Use your phone for the fastest photo capture</p>
                    <p className="text-[13px] text-zinc-600 mt-1 leading-relaxed">
                      Scan once and finish the upload from your phone camera.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTextMeLink}
                    className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold px-4 h-9 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" /> Send Link to My Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQR((s) => !s)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 text-[13px] font-semibold px-4 h-9 transition-colors"
                  >
                    <QrCode className="w-4 h-4" /> {showQR ? "Hide QR Code" : "Show QR Code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 text-[13px] font-semibold px-4 h-9 transition-colors"
                  >
                    {copyState === "copied" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copyState === "copied" ? "Copied" : "Copy Secure Link"}
                  </button>
                </div>

                {showQR && secureLink && (
                  <div className="mt-4 flex items-center gap-4 rounded-xl bg-white border border-violet-200 p-4">
                    <div className="bg-white p-2 rounded-lg border border-zinc-200">
                      <QRCodeSVG value={secureLink} size={108} level="H" />
                    </div>
                    <p className="text-[12px] text-zinc-600 leading-relaxed">
                      Open your phone's camera and point it at the code. We'll keep this page in sync as photos arrive.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-violet-200 text-violet-700 shrink-0">
                  <Camera className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-zinc-900 leading-tight">Camera ready</p>
                  <p className="text-[12px] text-zinc-600 mt-0.5">Tap any photo tile to open your camera.</p>
                </div>
              </div>
            )}

            {/* Required photos */}
            {requiredShots.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-sm font-bold text-zinc-900">Required photos</h2>
                  <span className="text-[11px] font-semibold text-zinc-500">{completedCount} / {requiredShots.length}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {requiredShots.map((shot) => (
                    <PhotoTile
                      key={shot.shot_id}
                      label={shot.label}
                      state={shotState[shot.shot_id]}
                      exif={shotExif[shot.shot_id]}
                      onClick={() => handleTileClick(shot.shot_id)}
                      onRemove={() => removeShot(shot.shot_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Optional photos */}
            {optionalShots.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-sm font-bold text-zinc-900">Optional photos</h2>
                  <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Optional</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {optionalShots.map((shot) => (
                    <PhotoTile
                      key={shot.shot_id}
                      label={shot.label}
                      state={shotState[shot.shot_id]}
                      exif={shotExif[shot.shot_id]}
                      onClick={() => handleTileClick(shot.shot_id)}
                      onRemove={() => removeShot(shot.shot_id)}
                      optional
                    />
                  ))}
                </div>

                {/* Extras strip */}
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Anything else (extras)</p>
                  <div className="flex flex-wrap gap-2">
                    {extraPreviews.map((preview, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-zinc-200">
                        <img src={preview} alt={`Extra ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExtra(i)}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-zinc-900/80 text-white flex items-center justify-center"
                          aria-label="Remove extra"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => extraInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-200 hover:border-violet-400 hover:bg-violet-50/40 transition-colors flex flex-col items-center justify-center gap-1 text-zinc-500"
                      aria-label="Add extra photos"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Add</span>
                    </button>
                  </div>
                </div>
              </div>
            )}


            {/* What happens after upload — compact, single line each */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-900 mb-3">What happens after upload</h2>
              <ul className="space-y-2 text-[13px] text-zinc-600">
                {[
                  "Photos checked for clarity",
                  "AI reviews vehicle condition",
                  "We check for a stronger offer",
                ].map((line) => (
                  <li key={line} className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom CTA */}
            <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5 sticky bottom-3 z-10">
              <Button
                onClick={handleUpload}
                disabled={!requiredComplete || uploading || !hasNewUploads}
                className="w-full h-12 rounded-xl text-[15px] font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:bg-zinc-200 disabled:text-zinc-500"
                style={
                  requiredComplete && config.landing_cta_color
                    ? { background: config.landing_cta_color, color: config.landing_cta_text_color || "#ffffff" }
                    : undefined
                }
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
                ) : requiredComplete ? (
                  <><Upload className="w-4 h-4 mr-2" /> {ctaLabel}</>
                ) : (
                  ctaLabel
                )}
              </Button>
              <div className="mt-3 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/my-submission/${token}`)}
                  className="text-[13px] font-semibold text-zinc-600 hover:text-zinc-900 underline-offset-4 hover:underline"
                >
                  Keep My Current Offer
                </button>
                <p className="text-center text-[12px] text-zinc-500 inline-flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Your current offer remains available while we review your photos.
                </p>
              </div>
            </div>

          </section>

          {/* RIGHT — vehicle summary */}
          <aside className="lg:col-span-3">
            <VehicleSummaryCard
              vehicleStr={vehicleStr}
              mileage={submission.mileage}
              offer={submission.offered_price ?? null}
              image={vehicleImage}
            />
          </aside>
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

/* ------------------------------------------------------------------ */
/* Subcomponents                                                       */
/* ------------------------------------------------------------------ */

const Header = ({ config, token }: { config: any; token?: string }) => (
  <header className="border-b border-zinc-200 bg-white">
    <div className="max-w-[1180px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
      <Link to={token ? `/my-submission/${token}` : "/my-submission"} className="flex items-center gap-3 min-w-0">
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

const PROGRESS_STEPS = [
  { id: "condition", label: "Condition", state: "done" as const },
  { id: "usage", label: "Usage", state: "done" as const },
  { id: "contact", label: "Contact Info", state: "done" as const },
  { id: "offer", label: "Offer Ready", state: "done" as const },
  { id: "review", label: "Photo Review", state: "done" as const },
  { id: "photos", label: "Photos", state: "active" as const },
  { id: "result", label: "AI Result", state: "upcoming" as const },
];

const ProgressRail = () => (
  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sticky top-6">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-4">Your progress</p>
    <ol className="space-y-3.5">
      {PROGRESS_STEPS.map((step, i) => {
        const isDone = step.state === "done";
        const isActive = step.state === "active";
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={`relative inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0 ${
                isDone
                  ? "bg-emerald-500 text-white"
                  : isActive
                  ? "bg-violet-600 text-white ring-4 ring-violet-100"
                  : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {isDone ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`text-[13px] ${
                isActive ? "font-bold text-zinc-900" : isDone ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  </div>
);

const VehicleSummaryCard = ({
  vehicleStr,
  mileage,
  offer,
  image,
}: {
  vehicleStr: string;
  mileage?: string | null;
  offer: number | null;
  image: string | null;
}) => (
  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-3">Your vehicle</p>
    <div className="aspect-[4/3] rounded-xl bg-zinc-50 border border-zinc-100 mb-3 overflow-hidden flex items-center justify-center">
      {image ? (
        <img src={image} alt={vehicleStr} className="w-full h-full object-contain" />
      ) : (
        <ImageIcon className="w-8 h-8 text-zinc-300" aria-hidden />
      )}
    </div>
    <p className="text-[15px] font-bold tracking-tight text-zinc-900 leading-tight">{vehicleStr || "Your vehicle"}</p>
    {mileage && (
      <p className="text-[12px] text-zinc-500 mt-1">
        {Number(mileage).toLocaleString()} miles
      </p>
    )}
    <div className="mt-4 pt-4 border-t border-zinc-100">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Current firm offer</p>
      <p className="text-[26px] font-bold tracking-tight text-zinc-900 mt-1">{formatMoney(offer)}</p>
      <p className="mt-1 text-[11px] text-emerald-600 inline-flex items-center gap-1 font-semibold">
        <Lock className="w-3 h-3" /> Protected while we review
      </p>
    </div>
  </div>
);

const PhotoTile = ({
  label,
  state,
  exif,
  onClick,
  onRemove,
  optional = false,
}: {
  label: string;
  state?: ShotState;
  exif?: PhotoExifResult;
  onClick: () => void;
  onRemove: () => void;
  optional?: boolean;
}) => {
  const status: TileStatus = state?.status ?? (state?.uploaded ? "uploaded" : "empty");
  const isFilled = status === "selected" || status === "uploading" || status === "uploaded";

  // Border + background per honest state. No "AI checking" — that
  // happens server-side after submit; we never fake a scan on the tile.
  const borderClass =
    status === "uploaded"
      ? "border-emerald-400 bg-emerald-50/40"
      : status === "rejected"
      ? "border-orange-400 bg-orange-50/40"
      : status === "selected" || status === "uploading"
      ? "border-violet-400 bg-violet-50/30"
      : optional
      ? "border-dashed border-zinc-200 bg-zinc-50/30 hover:border-violet-300"
      : "border-dashed border-zinc-300 bg-white hover:border-violet-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all text-left ${borderClass}`}
    >
      {state?.preview ? (
        <img src={state.preview} alt={label} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 ${
          optional ? "text-zinc-400" : "text-zinc-500"
        }`}>
          <Camera className="w-5 h-5" aria-hidden="true" />
          <span className="text-[12px] font-semibold text-center leading-tight text-zinc-700">{label}</span>
          <span className="text-[10px] text-zinc-400">Tap to add photo</span>
        </div>
      )}

      {/* Status badge */}
      {status === "uploaded" && (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 shadow">
          <CheckCircle className="w-3 h-3" strokeWidth={3} /> Verified
        </span>
      )}
      {status === "uploading" && (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 shadow">
          <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
        </span>
      )}
      {status === "rejected" && (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow">
          Retake
        </span>
      )}

      {/* Remove (for tiles with a fresh file) */}
      {state?.file && status !== "uploading" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-zinc-900/80 text-white flex items-center justify-center"
          aria-label="Remove photo"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Bottom label bar (only on filled tiles) */}
      {isFilled && (
        <span className="absolute bottom-0 left-0 right-0 px-2.5 py-1.5 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] font-semibold tracking-tight flex items-center justify-between">
          <span className="truncate">{label}</span>
          {status === "uploaded" && <span className="text-emerald-300">Tap to retake</span>}
        </span>
      )}

      {/* Rejection reason */}
      {status === "rejected" && state?.rejectReason && (
        <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-orange-100 bg-orange-600/90 rounded px-1.5 py-0.5">
          {state.rejectReason}
        </span>
      )}

      {state?.file && exif && (
        <span className="absolute top-8 left-1.5">
          <PhotoTrustBadge tier={exif.trust_tier} reasons={exif.trust_reasons} distanceMiles={exif.distance_miles} />
        </span>
      )}
    </button>
  );
};

export default UploadPhotosClarity;
