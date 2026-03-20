import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2 } from "lucide-react";

interface Props {
  userId: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: Crop
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const pixelCrop = {
    x: (crop.x ?? 0) * scaleX,
    y: (crop.y ?? 0) * scaleY,
    width: (crop.width ?? 0) * scaleX,
    height: (crop.height ?? 0) * scaleY,
  };

  const outputSize = Math.min(pixelCrop.width, pixelCrop.height, 512);
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas crop failed"))),
      "image/jpeg",
      0.9
    );
  });
}

const AvatarCropDialog = ({ userId, currentUrl, onUploaded }: Props) => {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
      setOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }, []);

  const handleSave = async () => {
    if (!imgRef.current || !crop) return;
    setUploading(true);

    try {
      const blob = await getCroppedBlob(imgRef.current, crop);
      const path = `${userId}/avatar.jpg`;

      // Remove old file first (ignore errors)
      await supabase.storage.from("staff-avatars").remove([path]);

      const { error: uploadErr } = await supabase.storage
        .from("staff-avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("staff-avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Save URL to profile
      await supabase.from("profiles").update({ profile_image_url: publicUrl }).eq("user_id", userId);

      onUploaded(publicUrl);
      toast({ title: "Photo saved", description: "Profile picture updated." });
      setOpen(false);
      setImgSrc("");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onSelectFile} />

      <button
        onClick={() => inputRef.current?.click()}
        className="relative group w-10 h-10 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0 hover:ring-2 hover:ring-primary/40 transition-shadow"
        title="Upload photo"
      >
        {currentUrl ? (
          <img src={currentUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-muted-foreground">?</span>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-4 h-4 text-white" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!uploading) { setOpen(v); if (!v) setImgSrc(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Profile Photo</DialogTitle>
          </DialogHeader>

          {imgSrc && (
            <div className="flex justify-center max-h-[400px] overflow-hidden rounded-lg bg-muted">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                aspect={1}
                circularCrop
                className="max-h-[400px]"
              >
                <img
                  ref={imgRef}
                  src={imgSrc}
                  onLoad={onImageLoad}
                  alt="Crop preview"
                  className="max-h-[400px] w-auto"
                />
              </ReactCrop>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setImgSrc(""); }} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={uploading || !crop}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : "Save Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarCropDialog;
