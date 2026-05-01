import { useRef, useState } from "react";
import { Upload, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ManualScreenshotUploadProps {
  /** Page slot the upload populates: "home" | "listing" | "vdp". */
  pageKey: string;
  /** Friendly label shown in the button + toast (e.g. "homepage"). */
  pageLabel: string;
  /** Called with a data URL when the user picks an image. */
  onUpload: (dataUrl: string) => void;
  /** Compact = button-only, no help text. Used inside the failure panel. */
  compact?: boolean;
}

/**
 * Universal escape hatch for the Prospect Demo capture flow. When
 * Microlink can't render a dealer site (SOKAL strict, Cloudflare Bot
 * Management, EPROXYNEEDED without a Pro key), the rep takes a
 * screenshot in their own browser — which always works because they're
 * a real human — and drops it in here. The image gets converted to a
 * base64 data URL and stuffed into the same captures state slot the
 * auto-capture pipeline writes to, so all the overlay rendering and
 * AI analysis work exactly the same downstream.
 *
 * Why data URLs instead of Supabase storage:
 *   - No round trip / no bucket policy to wire
 *   - Works offline / on slow connections (it's all in-memory)
 *   - Captures state already persists to localStorage, so the choice
 *     survives a refresh (Microlink CDN URLs can also expire 24h, so
 *     a data URL isn't worse on persistence)
 *   - Trade-off: ~33% size bloat from base64. With three large PNGs
 *     that's ~3MB, fits in localStorage's 5MB budget. We resize
 *     anything over 1600px wide to keep the budget safe.
 */
const ManualScreenshotUpload = ({
  pageKey,
  pageLabel,
  onUpload,
  compact = false,
}: ManualScreenshotUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Image only",
        description: "Pick a PNG, JPG, or WebP screenshot.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1600);
      onUpload(dataUrl);
      setDone(true);
      toast({
        title: "Uploaded",
        description: `Using your ${pageLabel} screenshot for the demo.`,
      });
      setTimeout(() => setDone(false), 4000);
    } catch (e: any) {
      toast({
        title: "Couldn't read that image",
        description: e?.message || "Try a different file.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={compact ? "" : "mt-3"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "sm"}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="gap-1.5 text-xs"
      >
        {busy ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Reading image…
          </>
        ) : done ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Uploaded
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" />
            {compact ? `Upload ${pageLabel} screenshot` : "Upload manually"}
          </>
        )}
      </Button>
      {!compact && (
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
          Take the screenshot yourself (Cmd+Shift+4 on Mac, Win+Shift+S on Windows) and drop it in. Use this for sites with bot protection.
        </p>
      )}
    </div>
  );
};

/**
 * Read a File and produce a base64 data URL, downscaling images
 * wider than `maxWidth` so localStorage / payload sizes stay reasonable.
 * Preserves aspect ratio. Encodes as JPEG at 0.85 for photographic
 * dealer-site screenshots; PNG sources stay PNG so transparency
 * survives.
 */
function fileToResizedDataUrl(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read file"));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Image decode failed"));
      img.onload = () => {
        if (img.width <= maxWidth) {
          resolve(src);
          return;
        }
        const ratio = maxWidth / img.width;
        const canvas = document.createElement("canvas");
        canvas.width = maxWidth;
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG preserves transparency; JPG saves bytes for photos.
        const isPng = file.type === "image/png";
        const out = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85);
        resolve(out);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export default ManualScreenshotUpload;
