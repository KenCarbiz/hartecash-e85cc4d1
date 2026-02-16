import { useState, useRef, useEffect } from "react";
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
  { key: "carfax", label: "Carfax" },
  { key: "window_sticker", label: "Window Sticker (if available)" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const StaffFileUpload = ({ token, bucket, onUploadComplete }: StaffFileUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ [key: number]: string }>({});
  const [docType, setDocType] = useState("drivers_license");
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
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
    
    // Generate previews for images
    added.forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const currentIndex = files.length + index;
          setPreviews(prev => ({ ...prev, [currentIndex]: e.target?.result as string }));
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
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

      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drag and drop files here or{" "}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-primary hover:underline"
            >
              click to browse
            </button>
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase">Files</div>
          {previews && Object.keys(previews).length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map((f, i) => (
                previews[i] ? (
                  <div key={i} className="relative">
                    <img 
                      src={previews[i]} 
                      alt={f.name}
                      className="w-full h-20 object-cover rounded-md border border-border"
                    />
                    <button 
                      onClick={() => removeFile(i)} 
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="text-xs mt-1 truncate text-muted-foreground">{f.name}</p>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs h-20 relative group">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="max-w-[80px] truncate">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-destructive hover:text-destructive/80 ml-auto">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              ))}
            </div>
          )}
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
