import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import {
  FileText, CheckCircle, Upload, X, Plus, ArrowLeft, CircleCheck,
  Camera, AlertTriangle, ShieldCheck, CreditCard, ClipboardList, ScrollText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileQRBanner from "@/components/upload/MobileQRBanner";
import DocumentCameraCapture from "@/components/upload/DocumentCameraCapture";
import { getDocDimensions } from "@/lib/documentDimensions";
import logoFallback from "@/assets/logo-placeholder-white.png";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const DOC_TYPES = [
  { key: "drivers_license_front", label: "Driver's License (Front)", icon: CreditCard, ocr: true },
  { key: "drivers_license_back", label: "Driver's License (Back)", icon: CreditCard, ocr: false },
  { key: "registration", label: "Registration", icon: ClipboardList, ocr: false },
  { key: "title_front", label: "Title (Front)", icon: ScrollText, ocr: true },
  { key: "title_back", label: "Title (Back)", icon: ScrollText, ocr: false },
];

interface SubmissionInfo {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  photos_uploaded: boolean;
  state: string | null;
  zip: string | null;
  vin: string | null;
}

const UploadDocs = () => {
  const { token } = useParams<{ token: string }>();
  const { config } = useSiteConfig();
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<{ file: File; docType: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [activeDocType, setActiveDocType] = useState<string>("");
  const [cameraDocType, setCameraDocType] = useState<string | null>(null);
  const [vinStatus, setVinStatus] = useState<"match" | "mismatch" | "no_vin_on_file" | "not_legible" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const { data, error: err } = await supabase
        .rpc("get_submission_by_token", { _token: token })
        .maybeSingle();
      if (err || !data) { setError("Submission not found. Please check your link."); }
      else { setSubmission(data as unknown as SubmissionInfo); }
      setLoading(false);
    };
    fetchSubmission();
  }, [token]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_FILES = 30;

  const addFileEntry = useCallback((file: File, docType: string, preview: string) => {
    setFiles(prev => {
      if (prev.length >= MAX_FILES) {
        setError(`Maximum ${MAX_FILES} documents allowed.`);
        return prev;
      }
      return [...prev, { file, docType, preview }];
    });
  }, []);

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
        addFileEntry(f, activeDocType, f.type.startsWith("image/") ? (e.target?.result as string) : "");
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
    let dlFrontPath: string | null = null;
    let titleFrontPath: string | null = null;
    try {
      for (const { file, docType } of files) {
        const ext = file.name.split(".").pop();
        const path = `${token}/${docType}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("customer-documents")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
        if (docType === "drivers_license_front") dlFrontPath = path;
        if (docType === "title_front") titleFrontPath = path;
      }
      await supabase.rpc("mark_docs_uploaded", { _token: token! });
      if (submission?.id) {
        safeInvoke("send-notification", {
          body: { trigger_key: "docs_uploaded", submission_id: submission.id },
          context: { from: "UploadDocs.submit" },
        });
      }

      if (dlFrontPath) {
        try {
          const { data: signedData } = await supabase.storage
            .from("customer-documents")
            .createSignedUrl(dlFrontPath, 300);
          if (signedData?.signedUrl) {
            await supabase.functions.invoke("parse-drivers-license", {
              body: { imageUrl: signedData.signedUrl, submissionToken: token },
            });
          }
        } catch (ocrErr) {
          console.warn("DL OCR auto-fill skipped:", ocrErr);
        }
      }

      if (titleFrontPath) {
        try {
          const { data: signedData } = await supabase.storage
            .from("customer-documents")
            .createSignedUrl(titleFrontPath, 300);
          if (signedData?.signedUrl) {
            const { data: vinResult } = await supabase.functions.invoke("parse-title-vin", {
              body: { imageUrl: signedData.signedUrl, submissionToken: token },
            });
            if (vinResult?.vin_match) {
              setVinStatus(vinResult.vin_match);
            }
          }
        } catch (ocrErr) {
          console.warn("Title VIN verification skipped:", ocrErr);
        }
      }

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

  const triggerCamera = (docType: string) => {
    setCameraDocType(docType);
  };

  const handleCameraCapture = (file: File, preview: string) => {
    if (cameraDocType) {
      addFileEntry(file, cameraDocType, preview);
    }
    setCameraDocType(null);
  };

  const filesPerType = (type: string) => files.filter(f => f.docType === type);

  const isComplete = useMemo(() => {
    const has = (type: string) => files.some(f => f.docType === type);
    const hasDLFront = has("drivers_license_front");
    const hasDLBack = has("drivers_license_back");
    const hasRegistration = has("registration");
    const hasTitleFront = has("title_front");
    const hasTitleBack = has("title_back");
    return hasDLFront && hasDLBack && (hasRegistration || (hasTitleFront && hasTitleBack));
  }, [files]);

  const customerState = submission?.state || null;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
    </div>
  );

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
        <h1 className="font-display text-3xl text-foreground mb-3">Documents Received!</h1>
        <p className="text-muted-foreground leading-relaxed">
          Thank you{submission?.name ? `, ${submission.name}` : ""}! We've received your documents
          {submission?.vehicle_year && ` for your ${submission.vehicle_year} ${submission.vehicle_make} ${submission.vehicle_model}`}.
          Our team will review them shortly.
        </p>

        {vinStatus && (
          <div className={`mt-4 rounded-xl p-3.5 text-sm flex items-center gap-2.5 ${
            vinStatus === "match"
              ? "bg-success/10 text-success border border-success/20"
              : vinStatus === "mismatch"
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-muted text-muted-foreground border border-border"
          }`}>
            {vinStatus === "match" ? (
              <>
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span>VIN verified — title matches our records ✓</span>
              </>
            ) : vinStatus === "mismatch" ? (
              <>
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>VIN on title doesn't match our records. Our team will review this.</span>
              </>
            ) : vinStatus === "no_vin_on_file" ? (
              <>
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <span>VIN captured from your title and added to your file.</span>
              </>
            ) : (
              <span>VIN could not be read from title — our team will verify manually.</span>
            )}
          </div>
        )}

        <Link to={`/my-submission/${token}`}>
          <Button variant="outline" className="mt-6 gap-2 border-border hover:bg-muted">
            <ArrowLeft className="w-4 h-4" /> Back to My Submission
          </Button>
        </Link>
      </div>
    </div>
  );

  const vehicleLabel = submission
    ? `${submission.vehicle_year ?? ""} ${submission.vehicle_make ?? ""} ${submission.vehicle_model ?? ""}`.trim()
    : "";

  return (
    <div className="min-h-screen bg-background">
      {cameraDocType && (
        <DocumentCameraCapture
          docLabel={DOC_TYPES.find(d => d.key === cameraDocType)?.label || "Document"}
          dimensions={getDocDimensions(cameraDocType, customerState)}
          onCapture={handleCameraCapture}
          onClose={() => setCameraDocType(null)}
        />
      )}

      {/* Header — same style as photo upload */}
      <div className="bg-primary text-primary-foreground px-6 py-4 mb-0">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to={`/my-submission/${token}`} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <img src={config.logo_white_url || logoFallback} alt={config.dealership_name} className="h-[70px] w-auto" />
          <h1 className="font-bold text-lg">Upload Documents</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7 text-primary/70" />
          </div>
          {vehicleLabel && (
            <p className="text-muted-foreground text-sm">{vehicleLabel}</p>
          )}
        </div>

        <MobileQRBanner url={`${window.location.origin}/docs/${token}`} />

        {/* Completion banner */}
        {isComplete && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <CircleCheck className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-success">All required documents added!</p>
              <p className="text-xs text-muted-foreground">You can still add more if needed.</p>
            </div>
          </div>
        )}

        <div className={`bg-card rounded-xl p-5 shadow-sm border transition-colors mb-6 ${isComplete ? "border-success/30 ring-1 ring-success/20" : "border-border"}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-base text-card-foreground tracking-wide">Documents Needed</h3>
            {isComplete && (
              <span className="text-xs bg-success/10 text-success font-semibold px-2.5 py-1 rounded-full">Complete</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Required: Driver's license (front & back) + either registration or title (front & back)
          </p>
          <div className="space-y-3">
            {DOC_TYPES.map(dt => {
              const typeFiles = filesPerType(dt.key);
              const hasFile = typeFiles.length > 0;
              const Icon = dt.icon;
              return (
                <div key={dt.key} className={`border rounded-xl p-3.5 transition-all ${hasFile ? "border-success/40 bg-success/5 ring-1 ring-success/10" : "border-border hover:border-primary/20"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-card-foreground flex items-center gap-2">
                      {hasFile ? (
                        <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-success" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/5 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-primary/60" />
                        </div>
                      )}
                      {dt.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => triggerCamera(dt.key)}
                        className="gap-1 text-xs border-border"
                      >
                        <Camera className="w-3 h-3" /> Capture
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => triggerUpload(dt.key)}
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-0.5" /> File
                      </Button>
                    </div>
                  </div>
                  {typeFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {typeFiles.map((f, i) => {
                        const globalIdx = files.indexOf(f);
                        return (
                          <div key={i} className="relative bg-muted rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-xs border border-border shadow-sm">
                            {f.preview ? (
                              <img src={f.preview} alt="" className="w-8 h-8 object-cover rounded" />
                            ) : (
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            )}
                            <span className="text-muted-foreground max-w-[100px] truncate">{f.file.name}</span>
                            <button onClick={() => removeFile(globalIdx)} className="text-destructive hover:text-destructive/80 transition-colors">
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

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4 text-center">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          size="lg"
          className={`w-full py-5 text-[17px] font-bold shadow-lg rounded-xl gap-2 ${
            isComplete
              ? "bg-success hover:bg-success/90 text-success-foreground shadow-success/20"
              : "bg-accent hover:bg-accent/90 text-accent-foreground shadow-accent/20"
          }`}
        >
          <Upload className="w-5 h-5" />
          {uploading ? "Uploading & verifying..." : `Upload ${files.length} Document${files.length !== 1 ? "s" : ""}`}
        </Button>

        <p className="text-center mt-5 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-success" />
          </span>
          Your documents are securely uploaded and only used for your vehicle transaction.
        </p>
      </div>
    </div>
  );
};

export default UploadDocs;
