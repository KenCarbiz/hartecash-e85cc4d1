import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Camera, CheckCircle, Upload, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmissionInfo {
  id: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
  photos_uploaded: boolean;
}

const UploadPhotos = () => {
  const { token } = useParams<{ token: string }>();
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!token) { setError("Invalid link."); setLoading(false); return; }
      const { data, error: err } = await supabase
        .from("submissions")
        .select("id, vehicle_year, vehicle_make, vehicle_model, name, photos_uploaded")
        .eq("token", token)
        .maybeSingle();
      if (err || !data) { setError("Submission not found. Please check your link."); }
      else if (data.photos_uploaded) { setDone(true); setSubmission(data); }
      else { setSubmission(data); }
      setLoading(false);
    };
    fetchSubmission();
  }, [token]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const added = Array.from(newFiles).filter(f => f.type.startsWith("image/"));
    setFiles(prev => [...prev, ...added]);
    added.forEach(f => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!submission || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${token}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("submission-photos")
          .upload(path, file, { contentType: file.type });
        if (uploadErr) throw uploadErr;
      }
      await supabase
        .from("submissions")
        .update({ photos_uploaded: true })
        .eq("token", token);
      setDone(true);
    } catch {
      setError("Upload failed. Please try again.");
    }
    setUploading(false);
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
        <h1 className="text-2xl font-bold text-foreground mb-2">Photos Received!</h1>
        <p className="text-muted-foreground">
          Thank you{submission?.name ? `, ${submission.name}` : ""}! We've received your photos
          {submission?.vehicle_year && ` for your ${submission.vehicle_year} ${submission.vehicle_make} ${submission.vehicle_model}`}.
          We'll be in touch with your cash offer shortly.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-6">
        <div className="text-center mb-6">
          <Camera className="w-12 h-12 text-accent mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-foreground mb-1">Upload Vehicle Photos</h1>
          {submission && (
            <p className="text-muted-foreground text-sm">
              {submission.vehicle_year} {submission.vehicle_make} {submission.vehicle_model}
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl p-5 shadow-lg mb-6">
          <h3 className="font-bold text-card-foreground mb-3">Photos we need:</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>📸 Front of vehicle</li>
            <li>📸 Back of vehicle</li>
            <li>📸 Driver side</li>
            <li>📸 Passenger side</li>
            <li>📸 Dashboard / odometer</li>
            <li>📸 Interior (front seats)</li>
            <li>📸 Any damage areas (if applicable)</li>
          </ul>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-input flex items-center justify-center hover:border-accent transition-colors"
            >
              <Plus className="w-8 h-8 text-muted-foreground" />
            </button>
          </div>
        )}

        {previews.length === 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-input rounded-xl p-8 text-center hover:border-accent transition-colors mb-4"
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="font-semibold text-card-foreground">Tap to take or select photos</p>
            <p className="text-sm text-muted-foreground mt-1">You can select multiple photos at once</p>
          </button>
        )}

        {error && <p className="text-destructive text-sm text-center mb-4">{error}</p>}

        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="w-full py-4 bg-accent hover:bg-accent/90 text-accent-foreground text-[17px] font-bold shadow-lg shadow-accent/30"
        >
          {uploading ? "Uploading..." : `Upload ${files.length} Photo${files.length !== 1 ? "s" : ""}`}
        </Button>

        <p className="text-center mt-4 text-[13px] text-muted-foreground">
          🔒 Your photos are securely uploaded and only used for your vehicle appraisal.
        </p>
      </div>
    </div>
  );
};

export default UploadPhotos;
