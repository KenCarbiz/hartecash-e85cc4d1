import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle, Upload, X, Plus, ArrowLeft, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileQRBanner from "@/components/upload/MobileQRBanner";
import harteLogoWhite from "@/assets/harte-logo-white.png";

const DOC_TYPES = [
  { key: "drivers_license_front", label: "Driver's License (Front)", emoji: "🪪" },
  { key: "drivers_license_back", label: "Driver's License (Back)", emoji: "🪪" },
  { key: "registration", label: "Registration", emoji: "📋" },
  { key: "title_front", label: "Title (Front)", emoji: "📄" },
  { key: "title_back", label: "Title (Back)", emoji: "📄" },
];

interface SubmissionInfo {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  photos_uploaded: boolean;
}

const UploadDocs = () => {
  const { token } = useParams<{ token: string }>();
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<{ file: File; docType: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [activeDocType, setActiveDocType] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const { data, error: err } = await supabase
        .rpc("get_submission_by_token", { _token: token })
        .maybeSingle();
      if (err || !data) { setError("Submission not found. Please check your link."); }
      else { setSubmission(data); }
      setLoading(false);
    };
    fetchSubmission();
  }, [token]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES = 30;

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles || !activeDocType) return;
    const added = Array.from(newFiles).filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        setError(`File "${f.name}" exceeds 10MB limit.`);
        return false;
      }
      return true;
    });
    if (files.length + added.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} documents allowed.`);
      return;
    }
    added.forEach(f => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles(prev => [...prev, {
          file: f,
          docType: activeDocType,
          preview: f.type.startsWith("image/") ? (e.target?.result as string) : "",
        }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!submission || files.length === 0) return;
    setUploading(true);
    try {
      for (const { file, docType } of files) {
        const ext = file.name.split(".").pop();
        const path = `${token}/${docType}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("customer-documents")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
      }
      await supabase.rpc("mark_docs_uploaded", { _token: token! });
      setDone(true);
    } catch {
      setError("Upload failed. Please try again.");
    }
    setUploading(false);
  };

  const triggerUpload = (docType: string) => {
    setActiveDocType(docType);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const filesPerType = (type: string) => files.filter(f => f.docType === type);

  // Completion check: DL front + DL back + (registration OR (title front + title back))
  const isComplete = useMemo(() => {
    const hasDLFront = filesPerType("drivers_license_front").length > 0;
    const hasDLBack = filesPerType("drivers_license_back").length > 0;
    const hasRegistration = filesPerType("registration").length > 0;
    const hasTitleFront = filesPerType("title_front").length > 0;
    const hasTitleBack = filesPerType("title_back").length > 0;
    return hasDLFront && hasDLBack && (hasRegistration || (hasTitleFront && hasTitleBack));
  }, [files]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
    </div>
  );

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
        <h1 className="text-2xl font-bold text-foreground mb-2">Documents Received!</h1>
        <p className="text-muted-foreground">
          Thank you{submission?.name ? `, ${submission.name}` : ""}! We've received your documents
          {submission?.vehicle_year && ` for your ${submission.vehicle_year} ${submission.vehicle_make} ${submission.vehicle_model}`}.
          Our team will review them shortly.
        </p>
        <Link to={`/my-submission/${token}`}>
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to My Submission
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-6 py-4 mb-0">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to={`/my-submission/${token}`} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={harteLogoWhite} alt="Harte" className="h-12 w-auto" />
          <h1 className="font-bold text-lg">Upload Documents</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto p-6">
        <div className="text-center mb-6">
          <FileText className="w-12 h-12 text-accent mx-auto mb-3" />
          {submission && (
            <p className="text-muted-foreground text-sm">
              {submission.vehicle_year} {submission.vehicle_make} {submission.vehicle_model}
            </p>
          )}
        </div>

        <MobileQRBanner url={`${window.location.origin}/docs/${token}`} />

        {/* Completion banner */}
        {isComplete && (
          <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4 flex items-center gap-3">
            <CircleCheck className="w-6 h-6 text-success flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success">All required documents added!</p>
              <p className="text-xs text-muted-foreground">You can still add more if needed.</p>
            </div>
          </div>
        )}

        <div className={`bg-card rounded-xl p-5 shadow-lg mb-6 transition-colors ${isComplete ? "ring-2 ring-success/40" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-card-foreground">Documents needed:</h3>
            {isComplete && <span className="text-xs bg-success/10 text-success font-semibold px-2 py-0.5 rounded-full">Complete ✓</span>}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Required: Driver's license (front & back) + either registration or title (front & back)
          </p>
          <div className="space-y-3">
            {DOC_TYPES.map(dt => {
              const typeFiles = filesPerType(dt.key);
              const hasFile = typeFiles.length > 0;
              return (
                <div key={dt.key} className={`border rounded-lg p-3 transition-colors ${hasFile ? "border-success/40 bg-success/5" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-card-foreground flex items-center gap-1.5">
                      {hasFile ? <CheckCircle className="w-4 h-4 text-success" /> : null}
                      {dt.emoji} {dt.label}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerUpload(dt.key)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {hasFile ? "More" : "Add"}
                    </Button>
                  </div>
                  {typeFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {typeFiles.map((f, i) => {
                        const globalIdx = files.indexOf(f);
                        return (
                          <div key={i} className="relative bg-muted rounded-md px-2 py-1 flex items-center gap-1.5 text-xs">
                            {f.preview ? (
                              <img src={f.preview} alt="" className="w-8 h-8 object-cover rounded" />
                            ) : (
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="text-muted-foreground max-w-[100px] truncate">{f.file.name}</span>
                            <button onClick={() => removeFile(globalIdx)} className="text-destructive hover:text-destructive/80">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />

        {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className={`w-full py-4 text-[17px] font-bold shadow-lg ${
            isComplete
              ? "bg-success hover:bg-success/90 text-success-foreground shadow-success/30"
              : "bg-accent hover:bg-accent/90 text-accent-foreground shadow-accent/30"
          }`}
        >
          {uploading ? "Uploading..." : `Upload ${files.length} Document${files.length !== 1 ? "s" : ""}`}
        </Button>

        <p className="text-center mt-4 text-[13px] text-muted-foreground">
          🔒 Your documents are securely uploaded and only used for your vehicle transaction.
        </p>
      </div>
    </div>
  );
};

export default UploadDocs;
