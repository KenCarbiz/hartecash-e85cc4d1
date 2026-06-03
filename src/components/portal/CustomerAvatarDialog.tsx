// CustomerAvatarDialog — lets a portal user either upload an image
// (with square crop) or pick from a curated preset gallery. The
// resulting value is handed to the parent via onSaved() and also
// pushed into localStorage via setCustomerAvatar() so any other
// component listening through useCustomerAvatar() updates instantly.
//
// Why localStorage instead of a Supabase bucket: portal visitors are
// authenticated by a magic-link token, not a Supabase session. Adding
// a public bucket + RLS + new migration is overkill for an avatar.
// Local persistence is fine for now and a clean swap target later.

import { useCallback, useRef, useState } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";
import { Camera, Loader2, Upload, Sparkles, RotateCcw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setCustomerAvatar } from "./useCustomerAvatar";

// Curated preset avatars rendered as inline SVG so the gallery works
// offline and avoids a third-party API key. Each preset is a friendly
// monogram-style mark on a colored gradient — kept abstract on purpose
// so the customer isn't picking a face that doesn't look like them.
const PRESETS: { id: string; label: string; svg: string }[] = [
  preset("violet",  "#A78BFA", "#6D28D9", "★"),
  preset("teal",    "#5EEAD4", "#0E9488", "◆"),
  preset("amber",   "#FCD34D", "#B45309", "●"),
  preset("rose",    "#FDA4AF", "#BE123C", "♥"),
  preset("sky",     "#7DD3FC", "#0369A1", "▲"),
  preset("emerald", "#86EFAC", "#047857", "✿"),
  preset("slate",   "#CBD5E1", "#334155", "⬢"),
  preset("orange",  "#FDBA74", "#C2410C", "☀"),
  preset("pink",    "#F9A8D4", "#9D174D", "✦"),
  preset("indigo",  "#A5B4FC", "#3730A3", "◉"),
  preset("lime",    "#BEF264", "#3F6212", "❖"),
  preset("fuchsia", "#F0ABFC", "#86198F", "❀"),
];

function preset(id: string, from: string, to: string, glyph: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g-${id})"/><text x="40" y="48" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="32" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">${glyph}</text></svg>`;
  return { id, label: id, svg: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

function centerSquare(w: number, h: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 80 }, 1, w, h), w, h);
}

async function cropToDataUrl(image: HTMLImageElement, crop: Crop): Promise<string> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sx = (crop.x ?? 0) * scaleX;
  const sy = (crop.y ?? 0) * scaleY;
  const sw = (crop.width ?? 0) * scaleX;
  const sh = (crop.height ?? 0) * scaleY;
  // Cap the stored avatar at 256px square to keep the localStorage
  // entry under a few hundred KB even for a phone photo.
  const out = Math.min(Math.max(sw, sh), 256);
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, out, out);
  return canvas.toDataURL("image/jpeg", 0.85);
}

interface Props {
  open: boolean;
  onClose: () => void;
  token: string | null;
  currentInitials: string;
  currentUrl: string | null;
  onSaved: (url: string | null) => void;
}

export const CustomerAvatarDialog = ({
  open, onClose, token, currentInitials, currentUrl, onSaved,
}: Props) => {
  const [tab, setTab] = useState<"upload" | "preset">("upload");
  const [imgSrc, setImgSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [saving, setSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is larger than 5 MB. Pick a smaller one.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerSquare(width, height));
  }, []);

  const handleSaveUpload = async () => {
    if (!imgRef.current || !crop) return;
    setSaving(true);
    try {
      const dataUrl = await cropToDataUrl(imgRef.current, crop);
      setCustomerAvatar(token, dataUrl);
      onSaved(dataUrl);
      toast.success("Profile photo updated");
      reset();
      onClose();
    } catch (err) {
      toast.error("Couldn't save the photo. Try a different image.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreset = () => {
    if (!selectedPreset) return;
    const chosen = PRESETS.find(p => p.id === selectedPreset);
    if (!chosen) return;
    setCustomerAvatar(token, chosen.svg);
    onSaved(chosen.svg);
    toast.success("Avatar updated");
    reset();
    onClose();
  };

  const handleRemove = () => {
    setCustomerAvatar(token, null);
    onSaved(null);
    toast.success("Avatar removed");
    reset();
    onClose();
  };

  const reset = () => {
    setImgSrc("");
    setCrop(undefined);
    setSelectedPreset(null);
    setTab("upload");
  };

  const onOpenChange = (next: boolean) => {
    if (saving) return;
    if (!next) { reset(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change avatar</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F4F6FA] rounded-xl">
          <button
            onClick={() => setTab("upload")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === "upload" ? "bg-white text-[#06194A] shadow-sm" : "text-[#53627A]"
            }`}
          >
            <Upload className="w-4 h-4" /> Upload Photo
          </button>
          <button
            onClick={() => setTab("preset")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === "preset" ? "bg-white text-[#06194A] shadow-sm" : "text-[#53627A]"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Choose Avatar
          </button>
        </div>

        {/* Current avatar preview */}
        <div className="flex items-center gap-3 py-2">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#EEF0FF] to-[#E0E7FF] text-[#6D28D9] grid place-items-center text-lg font-bold ring-1 ring-[#C7D2FE]/60">
            {currentUrl
              ? <img src={currentUrl} alt="" className="w-full h-full object-cover" />
              : currentInitials}
          </div>
          <div className="text-xs text-[#53627A]">
            <div className="font-semibold text-[#06194A]">Current photo</div>
            <div>{currentUrl ? "Tap save after picking a new one." : "No custom photo set."}</div>
          </div>
          {currentUrl && (
            <button
              onClick={handleRemove}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#BE123C] hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>

        {/* Upload tab */}
        {tab === "upload" && (
          <div className="space-y-3">
            {!imgSrc ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-10 rounded-xl border-2 border-dashed border-[#C7D2FE] bg-[#F8F9FD] text-center hover:bg-[#F0F2FA] transition"
              >
                <Camera className="w-7 h-7 mx-auto text-[#6D28D9] mb-2" />
                <div className="text-sm font-semibold text-[#06194A]">Click to choose an image</div>
                <div className="text-xs text-[#8893A8] mt-0.5">JPG or PNG, up to 5 MB</div>
              </button>
            ) : (
              <div className="flex justify-center max-h-[360px] overflow-hidden rounded-lg bg-[#F4F6FA]">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  aspect={1}
                  circularCrop
                  className="max-h-[360px]"
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    onLoad={onImgLoad}
                    alt="Crop preview"
                    className="max-h-[360px] w-auto"
                  />
                </ReactCrop>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onSelectFile}
            />
            {imgSrc && (
              <div className="flex justify-center">
                <button
                  onClick={() => { setImgSrc(""); setCrop(undefined); }}
                  className="text-xs text-[#6D28D9] hover:underline"
                >
                  Pick a different image
                </button>
              </div>
            )}
          </div>
        )}

        {/* Preset tab */}
        {tab === "preset" && (
          <div className="grid grid-cols-6 gap-3 py-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                className={`relative aspect-square rounded-full overflow-hidden ring-2 transition ${
                  selectedPreset === p.id
                    ? "ring-[#6D28D9] scale-110"
                    : "ring-transparent hover:ring-[#C7D2FE]"
                }`}
                aria-label={`Avatar ${p.label}`}
              >
                <img src={p.svg} alt="" className="w-full h-full" />
              </button>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {tab === "upload" ? (
            <Button onClick={handleSaveUpload} disabled={saving || !imgSrc || !crop}>
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : "Save Photo"}
            </Button>
          ) : (
            <Button onClick={handleSavePreset} disabled={!selectedPreset}>
              Use This Avatar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerAvatarDialog;
