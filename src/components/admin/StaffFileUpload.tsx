import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StaffFileUploadProps {
  token: string;
  bucket: "submission-photos" | "customer-documents";
  onUploadComplete: () => void;
}

const DOC_TYPES = [
  { key: "drivers_license", label: "Driver's License" },
  { key: "registration", label: "Registration" },
  { key: "title_inquiry", label: "Title Inquiry" },
  { key: "title", label: "Title" },
  { key: "payoff_verification", label: "Payoff Verification" },
  { key: "appraisal", label: "Appraisal" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const StaffFileUpload = ({ token, bucket, onUploadComplete }: StaffFileUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState("drivers_license");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isPhotos = bucket === "submission-photos";
  const accept = isPhotos ? "image/*" : "image/*,.pdf";

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const added = Array.from(newFiles).filter(f => {
      if (isPhotos && !f.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: "Only images are allowed for photos.", variant: "destructive" });
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: "File too large", description: `"${f.name}" exceeds 10MB limit.`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...added]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = isPhotos
          ? `${token}/${uniqueName}`
          : `${token}/${docType}/${uniqueName}`;

        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type });
        if (error) throw error;
      }

      // Mark as uploaded
      if (isPhotos) {
        await supabase.rpc("mark_photos_uploaded", { _token: token });
      } else {
        await supabase.rpc("mark_docs_uploaded", { _token: token });
      }

      toast({ title: "Uploaded", description: `${files.length} file${files.length !== 1 ? "s" : ""} uploaded successfully.` });
      setFiles([]);
      setShowUpload(false);
      onUploadComplete();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  if (!showUpload) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowUpload(true)} className="mt-2">
        <Upload className="w-3 h-3 mr-1" /> Add {isPhotos ? "Photos" : "Documents"}
      </Button>
    );
  }

  return (
    <div className="mt-3 border border-border rounded-lg p-3 bg-background space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Upload {isPhotos ? "Photos" : "Documents"}
        </span>
        <button onClick={() => { setShowUpload(false); setFiles([]); }} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isPhotos && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Document Type</label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(dt => (
                <SelectItem key={dt.key} value={dt.key}>{dt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs">
              <FileText className="w-3 h-3 text-muted-foreground" />
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button onClick={() => removeFile(i)} className="text-destructive hover:text-destructive/80">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Plus className="w-3 h-3 mr-1" /> Select Files
        </Button>
        {files.length > 0 && (
          <Button size="sm" onClick={handleUpload} disabled={uploading}>
            <Upload className="w-3 h-3 mr-1" />
            {uploading ? "Uploading..." : `Upload ${files.length}`}
          </Button>
        )}
      </div>
    </div>
  );
};

export default StaffFileUpload;
