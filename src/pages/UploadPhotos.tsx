import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera, CheckCircle, X, Plus, ArrowLeft, Upload, CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import UploadSkeleton from "@/components/UploadSkeleton";
import MobileQRBanner from "@/components/upload/MobileQRBanner";
import PhotoGuide from "@/components/upload/PhotoGuide";
import VehicleCameraCapture from "@/components/upload/VehicleCameraCapture";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePhotoConfig, type PhotoShot } from "@/hooks/usePhotoConfig";
import { classToArchetype, type VehicleArchetype } from "@/lib/vehicleArchetypes";
import logoFallback from "@/assets/logo-placeholder-white.png";

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

type CategoryUploads = Record<string, { file?: File; preview?: string; uploaded?: boolean }>;

const UploadPhotos = () => {
  const { token } = useParams<{ token: string }>();
  const { config } = useSiteConfig();
  const isMobile = useIsMobile();
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryUploads, setCategoryUploads] = useState<CategoryUploads>({});
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cameraCategory, setCameraCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Fetch submission (includes bb_class_name for archetype mapping)
  useEffect(() => {
    const fetchSubmission = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const minDelay = new Promise(r => setTimeout(r, 1200));
      const fetchData = supabase.rpc("get_submission_by_token", { _token: token });
      const [, { data, error: err }] = await Promise.all([minDelay, fetchData]);
      if (err || !data || data.length === 0) { setError("Submission not found."); }
      else { setSubmission(data[0]); }
      setLoading(false);
    };
    fetchSubmission();
  }, [token]);

  // Load dealer photo config
  const dealershipId = submission?.dealership_id || "default";
  const { requiredShots, optionalShots, enabledShots, loading: configLoading } = usePhotoConfig(dealershipId);

  // Vehicle archetype from Black Book class
  const vehicleArchetype: VehicleArchetype = classToArchetype(submission?.bb_class_name);

  // Check existing uploads
  useEffect(() => {
    if (!token || !submission) return;
    const checkExisting = async () => {
      const { data } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 100 });
      if (!data) return;
      const existing: CategoryUploads = {};
      for (const shot of enabledShots) {
        const match = data.find((f) => f.name.startsWith(`${shot.shot_id}-`));
        if (match) {
          const { data: urlData } = supabase.storage
            .from("submission-photos")
            .getPublicUrl(`${token}/${match.name}`);
          existing[shot.shot_id] = { uploaded: true, preview: urlData.publicUrl };
        }
      }
      setCategoryUploads(existing);
    };
    checkExisting();
  }, [token, submission, enabledShots]);
  // Listen for postMessage from GhostCar iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;
      if (e.data.type === "ghostcar_photo") {
        const shotId = e.data.shotId as string;
        setCategoryUploads(prev => ({ ...prev, [shotId]: { uploaded: true } }));
      }
      if (e.data.type === "ghostcar_complete") {
        const captured = e.data.captured as Record<string, boolean>;
        const updates: CategoryUploads = {};
        for (const shotId of Object.keys(captured)) {
          updates[shotId] = { uploaded: true };
        }
        setCategoryUploads(prev => ({ ...prev, ...updates }));
        setCameraCategory(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;


  const handleCategoryClick = (categoryId: string) => {
    if (isMobile) {
      setCameraCategory(categoryId);
    } else {
      setActiveCategory(categoryId);
      fileInputRef.current?.click();
    }
  };

  const handleCameraCapture = (file: File, preview: string) => {
    setCategoryUploads((prev) => ({
      ...prev,
      [cameraCategory!]: { file, preview },
    }));
    setCameraCategory(null);
  };

  const handleCategoryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCategory) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > MAX_FILE_SIZE) { setError("File exceeds 10MB limit."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCategoryUploads((prev) => ({
        ...prev,
        [activeCategory]: { file, preview: ev.target?.result as string },
      }));
    };
    reader.readAsDataURL(file);
    setActiveCategory(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeCategory = (categoryId: string) => {
    setCategoryUploads((prev) => { const next = { ...prev }; delete next[categoryId]; return next; });
  };

  const addExtraFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const added = Array.from(fileList).filter((f) => {
      if (!f.type.startsWith("image/")) return false;
      if (f.size > MAX_FILE_SIZE) { setError(`"${f.name}" exceeds 10MB.`); return false; }
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
    (s) => categoryUploads[s.shot_id]?.file || categoryUploads[s.shot_id]?.uploaded
  );
  const hasNewUploads = Object.values(categoryUploads).some((v) => v.file) || extraFiles.length > 0;

  const handleUpload = async () => {
    if (!submission || !hasNewUploads) return;
    setUploading(true);
    try {
      for (const [catId, val] of Object.entries(categoryUploads)) {
        if (!val.file) continue;
        const ext = val.file.name.split(".").pop();
        const path = `${token}/${catId}-${Date.now()}.${ext}`;
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
        allFiles?.some((f) => f.name.startsWith(`${s.shot_id}-`))
      );
      if (allRequiredPresent) {
        await supabase.rpc("mark_photos_uploaded", { _token: token });
        if (submission?.id) {
          supabase.functions.invoke("send-notification", {
            body: { trigger_key: "photos_uploaded", submission_id: submission.id },
          }).catch(console.error);
        }
      }

      // Trigger AI damage analysis per photo
      if (submission?.id) {
        for (const [catId, val] of Object.entries(categoryUploads)) {
          if (!val.file) continue;
          const matchedFile = allFiles?.find((f) => f.name.startsWith(`${catId}-`));
          if (matchedFile) {
            supabase.functions.invoke("analyze-vehicle-damage", {
              body: {
                submission_id: submission.id,
                token,
                photo_category: catId,
                photo_path: `${token}/${matchedFile.name}`,
              },
            }).catch(console.error);
          }
        }
      }

      setDone(true);
    } catch {
      setError("Upload failed. Please try again.");
    }
    setUploading(false);
  };

  if (loading || configLoading) return <UploadSkeleton />;

  if (error && !submission) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
          <X className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="font-display text-2xl text-foreground mb-2">Oops!</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <h1 className="font-display text-3xl text-foreground mb-3">Photos Received!</h1>
        <p className="text-muted-foreground leading-relaxed">
          Thank you{submission?.name ? `, ${submission.name}` : ""}! We've received your photos
          {submission?.vehicle_year && ` for your ${submission.vehicle_year} ${submission.vehicle_make} ${submission.vehicle_model}`}.
          {requiredComplete
            ? " All required photos are in — we'll be in touch with your cash offer shortly."
            : " Upload the remaining required photos when you're ready."}
        </p>
        <Link to={`/my-submission/${token}`}>
          <Button variant="outline" className="mt-6 gap-2 border-border hover:bg-muted">
            <ArrowLeft className="w-4 h-4" /> Back to My Submission
          </Button>
        </Link>
      </div>
    </div>
  );

  const filledCount = requiredShots.filter(
    (s) => categoryUploads[s.shot_id]?.file || categoryUploads[s.shot_id]?.uploaded
  ).length;

  const renderShotCard = (shot: PhotoShot) => {
    const upload = categoryUploads[shot.shot_id];
    const hasPhoto = upload?.file || upload?.uploaded;
    return (
      <button
        key={shot.shot_id}
        type="button"
        onClick={() => handleCategoryClick(shot.shot_id)}
        className={`group relative bg-card rounded-xl overflow-hidden border transition-all shadow-sm hover:shadow-md ${
          hasPhoto
            ? "border-success/40 ring-1 ring-success/20"
            : shot.is_required ? "border-border hover:border-primary/30" : "border-dashed border-border hover:border-primary/30"
        }`}
      >
        {upload?.preview ? (
          <div className="relative aspect-[4/3]">
            <img src={upload.preview} alt={shot.label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <span className="absolute bottom-2.5 left-3 text-white text-xs font-bold tracking-wide">{shot.label}</span>
            {!upload.uploaded && (
              <button
                onClick={(e) => { e.stopPropagation(); removeCategory(shot.shot_id); }}
                className="absolute top-2 right-2 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:bg-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {hasPhoto && (
              <div className="absolute top-2 left-2 bg-success/90 backdrop-blur-sm rounded-full p-0.5 shadow-lg">
                <CheckCircle className="w-4 h-4 text-success-foreground" />
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 aspect-[4/3] flex flex-col justify-center items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Camera className="w-5 h-5 text-primary/70" />
            </div>
            <span className="text-sm font-semibold text-card-foreground">{shot.label}</span>
            <p className="text-[11px] text-muted-foreground leading-tight">{shot.description}</p>
            <Camera className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5" />
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-6 py-4 mb-0">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to={`/my-submission/${token}`} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={config.logo_white_url || harteLogoFallback} alt={config.dealership_name} className="h-[70px] w-auto" />
          <h1 className="font-bold text-lg">Upload Vehicle Photos</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8">
        <MobileQRBanner url={`${window.location.origin}/upload/${token}`} />
        <PhotoGuide />

        {/* Progress indicator */}
        <div className="bg-card rounded-xl p-5 shadow-sm border border-border mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-card-foreground">
              {filledCount} of {requiredShots.length} required
            </span>
            {requiredComplete && (
              <span className="text-xs font-semibold text-success flex items-center gap-1.5 bg-success/10 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-3.5 h-3.5" /> Complete
              </span>
            )}
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-500 ease-out"
              style={{ width: `${requiredShots.length > 0 ? (filledCount / requiredShots.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Required photo cards */}
        {requiredShots.length > 0 && (
          <section className="mb-6">
            <h3 className="font-display text-base text-card-foreground mb-3 tracking-wide">Required Photos</h3>
            <div className="grid grid-cols-2 gap-3">
              {requiredShots.map(renderShotCard)}
            </div>
          </section>
        )}

        {/* Optional photo cards */}
        {optionalShots.length > 0 && (
          <section className="mb-6">
            <h3 className="font-display text-base text-card-foreground mb-3 tracking-wide">Optional</h3>
            <div className="grid grid-cols-2 gap-3">
              {optionalShots.map(renderShotCard)}
            </div>
          </section>
        )}

        {/* Extra photos */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base text-card-foreground tracking-wide">Additional Photos</h3>
            <button onClick={() => extraInputRef.current?.click()}
              className="text-sm text-primary font-semibold flex items-center gap-1.5 hover:text-primary/80 transition-colors">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {extraPreviews.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {extraPreviews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border shadow-sm">
                  <img src={src} alt={`Extra ${i + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => removeExtra(i)}
                    className="absolute top-1 right-1 bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => extraInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/30 hover:bg-muted/30 transition-all group">
              <CircleDot className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2 group-hover:text-primary/40 transition-colors" />
              <p className="text-sm text-muted-foreground">Tap to add extra photos</p>
            </button>
          )}
        </section>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCategoryFile} />
        <input ref={extraInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => addExtraFiles(e.target.files)} />

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4 text-center">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        <Button onClick={handleUpload} disabled={!hasNewUploads || uploading} size="lg"
          className="w-full py-5 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/20 rounded-xl gap-2">
          <Upload className="w-5 h-5" />
          {uploading ? "Uploading..." : "Upload Photos"}
        </Button>

        <p className="text-center mt-5 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-success" />
          </span>
          Your photos are securely uploaded and only used for your vehicle appraisal.
        </p>
      </div>

      {/* Guided camera capture overlay — iframe-based GhostCar */}
      {cameraCategory && (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            onClick={() => setCameraCategory(null)}
            className="absolute top-3 right-3 z-[60] text-white bg-black/60 rounded-full p-1.5"
          >
            <X className="w-5 h-5" />
          </button>
          <iframe
            src={`/ghostcar.html?vehicle=${encodeURIComponent(vehicleArchetype)}`}
            className="w-full h-full border-none"
            allow="camera"
          />
        </div>
      )}
    </div>
  );
};

export default UploadPhotos;
