import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Camera, CheckCircle, Upload, X, Plus, ImageIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import UploadSkeleton from "@/components/UploadSkeleton";
import MobileQRBanner from "@/components/upload/MobileQRBanner";
import harteLogo from "@/assets/harte-logo.png";

interface SubmissionInfo {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  photos_uploaded: boolean;
}

const REQUIRED_CATEGORIES = [
  { id: "front", label: "Front", icon: "🚗", desc: "Centered, full vehicle visible" },
  { id: "rear", label: "Rear", icon: "🔙", desc: "Centered, license plate visible" },
  { id: "driver-side", label: "Driver Side", icon: "🚘", desc: "Full side view from a few feet away" },
  { id: "passenger-side", label: "Passenger Side", icon: "🚘", desc: "Full side view from a few feet away" },
  { id: "dashboard", label: "Dashboard", icon: "📊", desc: "Odometer reading clearly visible" },
  { id: "interior", label: "Interior", icon: "💺", desc: "Front seats, console, and steering wheel" },
];

const OPTIONAL_CATEGORIES = [
  { id: "damage", label: "Damage (if any)", icon: "⚠️", desc: "Close-up of any scratches, dents, or wear" },
];

const ALL_CATEGORIES = [...REQUIRED_CATEGORIES, ...OPTIONAL_CATEGORIES];

type CategoryUploads = Record<string, { file?: File; preview?: string; uploaded?: boolean }>;

const UploadPhotos = () => {
  const { token } = useParams<{ token: string }>();
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryUploads, setCategoryUploads] = useState<CategoryUploads>({});
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

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

  // Check existing uploads on load
  useEffect(() => {
    if (!token || !submission) return;
    const checkExisting = async () => {
      const { data } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 100 });
      if (!data) return;
      const existing: CategoryUploads = {};
      for (const cat of ALL_CATEGORIES) {
        const match = data.find((f) => f.name.startsWith(`${cat.id}-`));
        if (match) {
          const { data: urlData } = supabase.storage
            .from("submission-photos")
            .getPublicUrl(`${token}/${match.name}`);
          existing[cat.id] = { uploaded: true, preview: urlData.publicUrl };
        }
      }
      setCategoryUploads(existing);
    };
    checkExisting();
  }, [token, submission]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    fileInputRef.current?.click();
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
    setCategoryUploads((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
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

  const requiredComplete = REQUIRED_CATEGORIES.every(
    (cat) => categoryUploads[cat.id]?.file || categoryUploads[cat.id]?.uploaded
  );
  const hasNewUploads = Object.values(categoryUploads).some((v) => v.file) || extraFiles.length > 0;

  const handleUpload = async () => {
    if (!submission || !hasNewUploads) return;
    setUploading(true);
    try {
      // Upload category photos
      for (const [catId, val] of Object.entries(categoryUploads)) {
        if (!val.file) continue;
        const ext = val.file.name.split(".").pop();
        const path = `${token}/${catId}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, val.file, { contentType: val.file.type, upsert: false });
        if (uploadErr) throw uploadErr;
      }
      // Upload extra photos
      for (const file of extraFiles) {
        const ext = file.name.split(".").pop();
        const path = `${token}/extra-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
      }

      // Check if all required categories now have uploads
      const { data: allFiles } = await supabase.storage
        .from("submission-photos")
        .list(token, { limit: 100 });
      const allRequiredPresent = REQUIRED_CATEGORIES.every((cat) =>
        allFiles?.some((f) => f.name.startsWith(`${cat.id}-`))
      );
      if (allRequiredPresent) {
        await supabase.rpc("mark_photos_uploaded", { _token: token });
      }

      setDone(true);
    } catch {
      setError("Upload failed. Please try again.");
    }
    setUploading(false);
  };

  if (loading) return <UploadSkeleton />;

  if (error && !submission) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-bold text-foreground mb-2">Oops!</h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Photos Received!</h1>
        <p className="text-muted-foreground">
          Thank you{submission?.name ? `, ${submission.name}` : ""}! We've received your photos
          {submission?.vehicle_year && ` for your ${submission.vehicle_year} ${submission.vehicle_make} ${submission.vehicle_model}`}.
          {requiredComplete
            ? " All required photos are in — we'll be in touch with your cash offer shortly."
            : " Upload the remaining required photos when you're ready."}
        </p>
        <Link to={`/my-submission/${token}`}>
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to My Submission
          </Button>
        </Link>
      </div>
    </div>
  );

  const filledCount = REQUIRED_CATEGORIES.filter(
    (c) => categoryUploads[c.id]?.file || categoryUploads[c.id]?.uploaded
  ).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card text-card-foreground px-6 py-4 mb-0 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to={`/my-submission/${token}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={harteLogo} alt="Harte" className="h-12 w-auto" />
          <h1 className="font-bold text-lg">Upload Vehicle Photos</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto p-6">
        {submission && (
          <p className="text-muted-foreground text-sm text-center mb-4">
            {submission.vehicle_year} {submission.vehicle_make} {submission.vehicle_model}
          </p>
        )}

        <MobileQRBanner url={`${window.location.origin}/upload/${token}`} />

        {/* Progress indicator */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-card-foreground">
              {filledCount} of {REQUIRED_CATEGORIES.length} required photos
            </span>
            {requiredComplete && (
              <span className="text-xs font-medium text-success flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> All required photos added
              </span>
            )}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-500"
              style={{ width: `${(filledCount / REQUIRED_CATEGORIES.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Required photo cards */}
        <div className="space-y-2 mb-4">
          <h3 className="font-bold text-card-foreground text-sm">Required Photos:</h3>
          <div className="grid grid-cols-2 gap-2">
            {REQUIRED_CATEGORIES.map((cat) => {
              const upload = categoryUploads[cat.id];
              const hasPhoto = upload?.file || upload?.uploaded;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`relative bg-card rounded-xl overflow-hidden border-2 transition-all ${
                    hasPhoto ? "border-success/50" : "border-input hover:border-accent"
                  }`}
                >
                  {upload?.preview ? (
                    <div className="relative aspect-[4/3]">
                      <img src={upload.preview} alt={cat.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <span className="absolute bottom-2 left-2 text-white text-xs font-semibold">{cat.label}</span>
                      {!upload.uploaded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {hasPhoto && (
                        <CheckCircle className="absolute top-1 left-1 w-5 h-5 text-success drop-shadow" />
                      )}
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-sm font-semibold text-card-foreground">{cat.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{cat.desc}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional photo cards */}
        <div className="space-y-2 mb-4">
          <h3 className="font-bold text-card-foreground text-sm">Optional:</h3>
          <div className="grid grid-cols-2 gap-2">
            {OPTIONAL_CATEGORIES.map((cat) => {
              const upload = categoryUploads[cat.id];
              const hasPhoto = upload?.file || upload?.uploaded;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`relative bg-card rounded-xl overflow-hidden border-2 transition-all ${
                    hasPhoto ? "border-success/50" : "border-dashed border-input hover:border-accent"
                  }`}
                >
                  {upload?.preview ? (
                    <div className="relative aspect-[4/3]">
                      <img src={upload.preview} alt={cat.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <span className="absolute bottom-2 left-2 text-white text-xs font-semibold">{cat.label}</span>
                      {!upload.uploaded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      <CheckCircle className="absolute top-1 left-1 w-5 h-5 text-success drop-shadow" />
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-sm font-semibold text-card-foreground">{cat.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{cat.desc}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Extra photos */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-card-foreground text-sm">Additional Photos</h3>
            <button
              onClick={() => extraInputRef.current?.click()}
              className="text-sm text-accent font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {extraPreviews.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {extraPreviews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={src} alt={`Extra ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeExtra(i)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCategoryFile}
        />
        <input
          ref={extraInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => addExtraFiles(e.target.files)}
        />

        {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

        <Button
          onClick={handleUpload}
          disabled={!hasNewUploads || uploading}
          className="w-full py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30"
        >
          {uploading ? "Uploading..." : `Upload Photos`}
        </Button>

        <p className="text-center mt-4 text-[13px] text-muted-foreground">
          🔒 Your photos are securely uploaded and only used for your vehicle appraisal.
        </p>
      </div>
    </div>
  );
};

export default UploadPhotos;
