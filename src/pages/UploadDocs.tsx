import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, CheckCircle, Upload, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const DOC_TYPES = [
  { key: "drivers_license", label: "Driver's License", emoji: "🪪" },
  { key: "registration", label: "Registration", emoji: "📋" },
  { key: "title_inquiry", label: "Title Inquiry", emoji: "🔍" },
  { key: "title", label: "Title", emoji: "📄" },
  { key: "payoff_verification", label: "Payoff Verification", emoji: "💰" },
  { key: "appraisal", label: "Appraisal", emoji: "📊" },
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

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles || !activeDocType) return;
    const added = Array.from(newFiles);
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
      </div>
    </div>
  );

  const filesPerType = (type: string) => files.filter(f => f.docType === type);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-6">
        <div className="text-center mb-6">
          <FileText className="w-12 h-12 text-accent mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-foreground mb-1">Upload Documents</h1>
          {submission && (
            <p className="text-muted-foreground text-sm">
              {submission.vehicle_year} {submission.vehicle_make} {submission.vehicle_model}
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl p-5 shadow-lg mb-6">
          <h3 className="font-bold text-card-foreground mb-3">Documents needed:</h3>
          <div className="space-y-3">
            {DOC_TYPES.map(dt => {
              const typeFiles = filesPerType(dt.key);
              return (
                <div key={dt.key} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-card-foreground">
                      {dt.emoji} {dt.label}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerUpload(dt.key)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add
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
          className="w-full py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30"
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
