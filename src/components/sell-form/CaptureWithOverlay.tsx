import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image as ImageIcon, RotateCcw, X } from "lucide-react";

/**
 * Full-screen camera capture with a silhouette overlay — the
 * "CarMax-style" boost-photo experience. Replaces the native
 * <input type="file" capture> handoff so the customer:
 *
 *   1. Sees a live camera feed instead of the OS-default capture UI
 *   2. Has a translucent silhouette of the target shot (car face,
 *      side profile, dashboard, wheel, etc.) to align with — same
 *      principle as a passport-photo or check-deposit overlay
 *   3. Taps a single shutter button when framed
 *   4. Captures at video resolution (1080p when the device offers
 *      it) and converts to a JPEG File for the existing upload
 *      pipeline
 *
 * Falls back to the native file picker on:
 *   - Browsers without getUserMedia (older Edge / WKWebView)
 *   - Denied camera permission
 *   - Any caught error during stream setup
 *
 * Stream lifecycle is strict — every code path that closes the
 * modal stops every track so the customer's camera-active LED
 * doesn't linger. iOS Safari needs playsInline + muted on the
 * <video> or it tries to fullscreen-takeover.
 */

export interface CaptureWithOverlayProps {
  shotKey: string;     // "exterior_front" | "exterior_driver" | ...
  shotLabel: string;   // "Front" | "Driver Side" | ...
  tip?: string;        // "Whole front in frame" — surfaced as instruction
  onCapture: (file: File) => void;
  onFallback: () => void; // fires when we should hand off to the native picker
  onCancel: () => void;
}

const CaptureWithOverlay = ({
  shotKey,
  shotLabel,
  tip,
  onCapture,
  onFallback,
  onCancel,
}: CaptureWithOverlayProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("camera_unsupported");
        }
        // Rear-facing preferred, but fall through to whatever's
        // available so this still works on laptops + front-cam-only
        // devices. 1920x1080 ideal — browsers will negotiate down.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {
            // iOS sometimes needs a second nudge after the user
            // gesture; safe to ignore — onLoadedMetadata still fires.
          });
        }
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message || "";
        // Distinguish "denied" (user said no) from "unsupported"
        // (browser doesn't have the API) so the fallback message
        // is honest. Both end at onFallback though.
        if (msg.includes("Permission") || (e as Error).name === "NotAllowedError") {
          setError("camera_denied");
        } else if (msg === "camera_unsupported" || (e as Error).name === "NotFoundError") {
          setError("camera_unsupported");
        } else {
          setError("camera_failed");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCapturing(false);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setCapturing(false);
            return;
          }
          const file = new File([blob], `${shotKey}-${Date.now()}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          // Stop the stream BEFORE callback so the camera LED dies
          // immediately (good UX signal that capture worked).
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          onCapture(file);
        },
        "image/jpeg",
        0.92,
      );
    } catch {
      setCapturing(false);
    }
  };

  // Permission denied / unsupported — invite the native picker.
  // We do NOT auto-fallback because the customer might have just
  // mis-tapped on the permission prompt; offer a retry option.
  if (error) {
    const errorCopy =
      error === "camera_denied"
        ? "Camera access denied. You can grant access in your browser settings, or pick a photo from your library."
        : "Couldn't access the camera on this device. Pick a photo from your library instead.";
    return (
      <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-5 text-white">
          <Camera className="w-10 h-10 mx-auto text-white/60" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-white/80">{errorCopy}</p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onFallback}
              className="rounded-full px-6 h-12 bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              Choose from library
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] bg-black"
      role="dialog"
      aria-label={`Take ${shotLabel} photo`}
    >
      {/* Live feed. object-cover so the silhouette overlay's aspect
          assumptions hold across phone / tablet / laptop cams. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Subtle vignette so the silhouette reads regardless of the
          underlying scene's brightness. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_50%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />

      {/* Silhouette overlay — the alignment guide. White stroke +
          subtle outer glow for contrast over any lighting. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
        <ShotSilhouette shotKey={shotKey} className="w-full max-w-[440px] h-auto opacity-80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
      </div>

      {/* Top chrome — close button + shot label */}
      <div className="absolute top-0 left-0 right-0 px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button
          type="button"
          onClick={onCancel}
          className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
            {shotLabel}
          </p>
          {tip && (
            <p className="text-[12px] text-white/90 mt-0.5 leading-snug max-w-[240px]">
              {tip}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onFallback}
          className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
          aria-label="Pick from library"
          title="Pick from library"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom chrome — shutter button + retake hint */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-6 bg-gradient-to-t from-black/70 to-transparent flex flex-col items-center gap-3">
        <p className="text-[11px] text-white/70 leading-snug text-center max-w-[300px]">
          Line your {shotLabel.toLowerCase()} up with the outline, then tap to capture.
        </p>
        <div className="flex items-center justify-center gap-8">
          {/* Library shortcut on the left of the shutter, mirroring
              the iOS / Android camera UI convention. */}
          <button
            type="button"
            onClick={onFallback}
            className="w-12 h-12 rounded-2xl bg-white/10 text-white/80 flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Pick from library"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleShutter}
            disabled={!ready || capturing}
            aria-label="Take photo"
            className="w-20 h-20 rounded-full bg-white border-[6px] border-white/30 disabled:opacity-50 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="sr-only">Take photo</span>
          </button>

          {/* Symmetry placeholder so the shutter stays centered. */}
          <div className="w-12 h-12" aria-hidden="true" />
        </div>
      </div>

      <AnimatePresence>
        {!ready && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black"
          >
            <div className="flex items-center gap-3 text-white/70 text-sm">
              <RotateCcw className="w-4 h-4 animate-spin" aria-hidden="true" />
              Starting camera…
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CaptureWithOverlay;

/**
 * Per-shot silhouette overlays. White stroke, no fill, scaled to
 * the container width. Each silhouette sets up the customer's
 * mental model of what to align with the live feed.
 *
 * These don't have to be photo-realistic — they just need to
 * communicate "the front of a car / the side / the dashboard /
 * a wheel" at a glance. Inspired by the passport-photo and
 * check-deposit overlay convention: clearly diagrammatic, never
 * mistakable for a real edge of the live image.
 */
const ShotSilhouette = ({ shotKey, className }: { shotKey: string; className?: string }) => {
  const stroke = "white";
  const strokeWidth = 1.5;
  const common = {
    fill: "none",
    stroke,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (shotKey) {
    case "exterior_front":
      return (
        <svg viewBox="0 0 200 130" className={className}>
          {/* Hood + roof outline */}
          <path d="M30 95 Q30 60 50 50 L80 35 L120 35 L150 50 Q170 60 170 95" {...common} />
          {/* Bumper line */}
          <line x1="20" y1="95" x2="180" y2="95" {...common} />
          {/* Headlights */}
          <ellipse cx="55" cy="72" rx="14" ry="8" {...common} />
          <ellipse cx="145" cy="72" rx="14" ry="8" {...common} />
          {/* Grille */}
          <rect x="80" y="68" width="40" height="20" rx="3" {...common} />
          <line x1="85" y1="78" x2="115" y2="78" {...common} />
          {/* Wheels (lower edge) */}
          <circle cx="40" cy="105" r="10" {...common} />
          <circle cx="160" cy="105" r="10" {...common} />
        </svg>
      );

    case "exterior_driver":
    case "exterior_passenger":
      return (
        <svg viewBox="0 0 240 110" className={className}>
          {/* Side profile — windshield curve, roof, trunk */}
          <path
            d="M20 75 L40 75 Q50 55 70 50 L130 38 Q160 38 175 50 L210 65 L220 75"
            {...common}
          />
          <line x1="20" y1="80" x2="220" y2="80" {...common} />
          {/* Window glass */}
          <path d="M62 70 Q72 55 88 53 L138 45 Q150 47 162 56 L172 70" {...common} />
          <line x1="115" y1="48" x2="115" y2="70" {...common} />
          {/* Wheels */}
          <circle cx="55" cy="90" r="14" {...common} />
          <circle cx="185" cy="90" r="14" {...common} />
          {/* Door handle hint */}
          <line x1="100" y1="75" x2="115" y2="75" {...common} />
        </svg>
      );

    case "exterior_rear":
      return (
        <svg viewBox="0 0 200 130" className={className}>
          {/* Trunk + rear glass + roof */}
          <path d="M30 95 Q30 65 45 55 L75 42 L125 42 L155 55 Q170 65 170 95" {...common} />
          <line x1="20" y1="95" x2="180" y2="95" {...common} />
          {/* Rear glass */}
          <path d="M55 60 L80 50 L120 50 L145 60" {...common} />
          {/* Taillights */}
          <rect x="32" y="72" width="22" height="14" rx="3" {...common} />
          <rect x="146" y="72" width="22" height="14" rx="3" {...common} />
          {/* License plate area */}
          <rect x="80" y="78" width="40" height="14" rx="2" {...common} />
          {/* Wheels */}
          <circle cx="40" cy="105" r="10" {...common} />
          <circle cx="160" cy="105" r="10" {...common} />
        </svg>
      );

    case "dashboard_odometer":
      return (
        <svg viewBox="0 0 240 130" className={className}>
          {/* Steering wheel arc at the bottom */}
          <path d="M70 115 Q120 95 170 115" {...common} />
          <circle cx="120" cy="120" r="6" {...common} />
          {/* Gauge cluster — tach + speedo + center info */}
          <rect x="40" y="35" width="160" height="60" rx="10" {...common} />
          <circle cx="80" cy="65" r="22" {...common} />
          <circle cx="160" cy="65" r="22" {...common} />
          <rect x="110" y="55" width="20" height="20" rx="3" {...common} />
          {/* Odometer text-line hint inside center */}
          <line x1="113" y1="68" x2="127" y2="68" {...common} />
        </svg>
      );

    case "tires_wheels":
      return (
        <svg viewBox="0 0 200 200" className={className}>
          {/* Tire (outer) */}
          <circle cx="100" cy="100" r="85" {...common} />
          {/* Wheel (inner) */}
          <circle cx="100" cy="100" r="55" {...common} />
          {/* Hub */}
          <circle cx="100" cy="100" r="12" {...common} />
          {/* Spokes */}
          <line x1="100" y1="50" x2="100" y2="150" {...common} />
          <line x1="50" y1="100" x2="150" y2="100" {...common} />
          <line x1="65" y1="65" x2="135" y2="135" {...common} />
          <line x1="135" y1="65" x2="65" y2="135" {...common} />
          {/* Tread band hint (outer ring decorations) */}
          <circle cx="100" cy="100" r="78" strokeDasharray="4 4" {...common} />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 200 200" className={className}>
          <rect x="20" y="40" width="160" height="120" rx="12" {...common} />
        </svg>
      );
  }
};
