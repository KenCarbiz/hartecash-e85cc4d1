import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image as ImageIcon, RotateCcw, X, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ShotSilhouette, { type SilhouetteState } from "./captureSilhouettes";

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

// Brightness sampling — read a tiny canvas every ~500ms and
// average the luma. Below this threshold we surface a "too dark"
// banner; below the floor we strongly suggest more light. Tunable
// constants here based on testing across mid-range Android +
// iPhone in interior / underground / dusk lighting.
const LUMA_DARK_BANNER = 60;   // soft warning
const LUMA_DARK_FLOOR  = 35;   // hard warning, pulse the banner
const SAMPLE_INTERVAL_MS = 500;        // initial / "actively responding to light changes"
const SAMPLE_INTERVAL_SLOW_MS = 1500;  // throttled rate once light has stabilized
const SAMPLES_BEFORE_SLOW = 3;         // ticks of stability before throttling
// Permission pre-prompt is shown once per browser session — flag
// in sessionStorage so revisits don't re-explain. This boosts
// allow-rate measurably (industry data: 15–25% lift).
const PREPROMPT_SEEN_KEY = "hartecash-camera-preprompt-seen";

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
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [luma, setLuma] = useState<number | null>(null); // null = not yet sampled
  const [flashing, setFlashing] = useState(false);

  // Preview / review state — between shutter and onCapture, we
  // show the customer their captured photo full-screen and let
  // them choose Use this photo / Retake. CarMax-style review
  // beat that the immediate-save flow lacked.
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // AI-side quality check fires in the background once the
  // preview is up. Banner appears asynchronously when the AI
  // returns a flag — customer can still hit "Use this photo"
  // before verification finishes (verification is advisory).
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<{
    ok: boolean;
    reason?: string;
    hint?: string;
  } | null>(null);
  // Pre-prompt explainer — shown once per session before we
  // request camera permission. Skipping it (because the customer
  // saw it on a prior shot in this session) goes straight to
  // stream init.
  const [phase, setPhase] = useState<"prepromptt" | "starting">(() => {
    try {
      return sessionStorage.getItem(PREPROMPT_SEEN_KEY) === "1" ? "starting" : "prepromptt";
    } catch {
      return "starting";
    }
  });

  // Programmatic shutter "click" via WebAudio so we don't ship an
  // audio asset. Tiny exponential-decay click — sounds like a
  // real camera shutter without the file weight or autoplay
  // policy headaches.
  const playShutterClick = () => {
    try {
      const Ctx: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
      // Close the context after the click finishes so we don't
      // leak audio resources across multiple captures.
      setTimeout(() => ctx.close().catch((e) => console.debug("[CaptureWithOverlay] AudioContext.close rejected:", e)), 200);
    } catch { /* audio is best-effort polish — never block capture */ }
  };

  useEffect(() => {
    // Wait for the customer to acknowledge the pre-prompt before
    // requesting camera permission.
    if (phase !== "starting") return;
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
          await videoRef.current.play().catch((e: unknown) => {
            // iOS sometimes needs a second nudge after the user
            // gesture; safe to ignore — onLoadedMetadata still fires.
            console.debug("video.play deferred (autoplay):", e);
          });
        }
        setReady(true);

        // Start a low-frequency brightness sampler. We draw a tiny
        // 32×24 thumbnail of the live frame to a hidden canvas
        // and average the luma channel. Cheap (sub-millisecond)
        // and runs every 500ms so battery impact is negligible.
        if (!sampleCanvasRef.current) {
          sampleCanvasRef.current = document.createElement("canvas");
          sampleCanvasRef.current.width = 32;
          sampleCanvasRef.current.height = 24;
        }
        const sampleCtx = sampleCanvasRef.current.getContext("2d", { willReadFrequently: true });
        if (sampleCtx && videoRef.current) {
          // Stability-throttled, visibility-aware sampler. We read
          // luma every SAMPLE_INTERVAL_MS at first; once the value
          // has been stable (within ±5) for SAMPLES_BEFORE_SLOW
          // ticks, we back off to SAMPLE_INTERVAL_SLOW_MS. Skip the
          // read entirely when:
          //   - the page is hidden (background tab)
          //   - the video is paused (preview/review beat is up)
          //   - the modal already captured (previewFile set)
          // Saves real battery on long sessions without losing
          // responsiveness when light conditions actually change.
          let stableCount = 0;
          let lastLuma = -1;
          let currentInterval = SAMPLE_INTERVAL_MS;

          const tick = () => {
            const v = videoRef.current;
            if (!v || v.videoWidth === 0) return;
            // Hard-skip when nothing on the page can act on the result.
            if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
            if (v.paused) return;
            try {
              sampleCtx.drawImage(v, 0, 0, 32, 24);
              const data = sampleCtx.getImageData(0, 0, 32, 24).data;
              let sum = 0;
              const pixels = data.length / 4;
              for (let i = 0; i < data.length; i += 4) {
                // Rec. 709 luma — green dominates perceived brightness,
                // so this matches what the customer's eye sees better
                // than a flat RGB average.
                sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              }
              const next = sum / pixels;
              setLuma(next);

              // Stability-aware throttling — once light conditions
              // are steady, halve the sample rate. A real lighting
              // change resets the counter and we go back to fast.
              if (lastLuma >= 0 && Math.abs(next - lastLuma) < 5) {
                stableCount += 1;
              } else {
                stableCount = 0;
                if (currentInterval !== SAMPLE_INTERVAL_MS) {
                  // Light just changed — restart the interval so we
                  // pick up the new condition responsively.
                  if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
                  currentInterval = SAMPLE_INTERVAL_MS;
                  sampleTimerRef.current = setInterval(tick, currentInterval);
                }
              }
              lastLuma = next;

              if (stableCount >= SAMPLES_BEFORE_SLOW && currentInterval === SAMPLE_INTERVAL_MS) {
                if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
                currentInterval = SAMPLE_INTERVAL_SLOW_MS;
                sampleTimerRef.current = setInterval(tick, currentInterval);
              }
            } catch { /* CORS-tainted canvas etc. — give up silently */ }
          };

          sampleTimerRef.current = setInterval(tick, currentInterval);
        }
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
      if (sampleTimerRef.current) {
        clearInterval(sampleTimerRef.current);
        sampleTimerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [phase]);

  // Free the object-URL the preview screen built so it doesn't
  // leak when the modal unmounts (large blob, retained for life
  // of the page otherwise).
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Pause the live feed when the page is backgrounded. Saves
  // battery + bandwidth on long sessions and on iOS keeps the
  // green camera dot off when it doesn't need to be on. Resume
  // on visibility return only if the stream is still alive
  // (the customer might have been preview-reviewing during the
  // background event).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.visibilityState === "hidden") {
        try { v.pause(); } catch { /* noop */ }
      } else if (!previewFile && streamRef.current) {
        // Foreground + not in preview = resume. Autoplay-block on
        // some mobile browsers is expected; debug-log so it surfaces
        // in DevTools without spamming console.warn.
        v.play().catch((e) => console.debug("[CaptureWithOverlay] resume video.play rejected:", e));
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [previewFile]);

  // Fire the AI quality check in the background once we have the
  // captured file. Soft-fail on every error path — verification
  // is advisory, never a blocker. Customer can still hit "Use
  // this photo" before we get a result.
  const fireVerification = async (file: File) => {
    setVerifying(true);
    setVerification(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("verify-shot-photo", {
        body: { shot_key: shotKey, image_base64: dataUrl },
      });
      if (error) {
        // Edge function failed — assume ok so a flaky network
        // doesn't trap the customer in a retake loop.
        setVerification({ ok: true });
        return;
      }
      const v = (data || {}) as { ok?: boolean; reason?: string; hint?: string };
      setVerification({
        ok: v.ok !== false,
        reason: v.reason,
        hint: v.hint,
      });
    } catch {
      setVerification({ ok: true });
    } finally {
      setVerifying(false);
    }
  };

  const handleAcceptPreview = () => {
    if (!previewFile) return;
    // Stop the stream now — capture is final.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (sampleTimerRef.current) {
      clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
    onCapture(previewFile);
  };

  const handleRetakePreview = () => {
    // Discard the captured file, resume the live feed.
    setPreviewFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVerification(null);
    setVerifying(false);
    setCapturing(false);
    if (videoRef.current) {
      videoRef.current.play().catch((e) => console.debug("[CaptureWithOverlay] retake video.play rejected:", e));
    }
  };

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setCapturing(true);

    // ── Capture feedback — fires immediately so the customer
    // gets the click+flash+haptic combo even if the canvas work
    // takes a frame. White flash overlay (≈90ms), shutter click
    // via WebAudio, single haptic tick. All best-effort: any one
    // of them silently degrades on browsers that block.
    setFlashing(true);
    setTimeout(() => setFlashing(false), 90);
    playShutterClick();
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(20);
      }
    } catch { /* noop */ }

    try {
      // Straight drawImage from video to canvas. Modern browsers
      // deliver getUserMedia frames in display orientation
      // already; the previous "rotate on innerWidth-vs-videoWidth
      // mismatch" heuristic broke on tablets, foldables, external
      // monitors, and desktop QA (the cure became the disease).
      // If a future device genuinely returns mis-oriented frames
      // we'll handle it via screen.orientation + the underlying
      // MediaStreamTrack.getSettings().aspectRatio rather than a
      // viewport-width guess.
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCapturing(false);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
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
          // Pause the live feed (don't stop yet — Retake needs to
          // resume it without re-prompting for camera permission).
          // The brightness sampler stays paused along with the
          // video since drawImage on a paused element returns the
          // last frame.
          if (videoRef.current) {
            try { videoRef.current.pause(); } catch { /* noop */ }
          }
          // Build the preview URL from the blob so we don't keep
          // the canvas alive in memory.
          const url = URL.createObjectURL(blob);
          setPreviewFile(file);
          setPreviewUrl(url);
          setCapturing(false);
          // Background AI quality check — verification banner
          // shows asynchronously when the result lands.
          fireVerification(file);
        },
        "image/jpeg",
        0.92,
      );
    } catch {
      setCapturing(false);
    }
  };

  // ── Pre-prompt explainer ── First time the customer triggers
  // capture in this session, show a short why-we-need-the-camera
  // card before the OS permission dialog fires. Industry data
  // shows this lifts grant rates 15–25% because customers say no
  // to a cold prompt out of reflex. Skipped on subsequent shots
  // in the same session via sessionStorage.
  if (phase === "prepromptt") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 text-center"
      >
        <div className="max-w-sm space-y-5 text-white">
          <Camera className="w-10 h-10 mx-auto text-white/60" aria-hidden="true" />
          <h2 className="text-xl font-bold tracking-tight">
            Use your camera to frame each shot
          </h2>
          <p className="text-sm text-white/75 leading-relaxed">
            We'll show an outline of what to capture so the AI can read it clearly. Tap{" "}
            <span className="font-semibold text-white">Allow</span> when your browser asks for camera access.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                try { sessionStorage.setItem(PREPROMPT_SEEN_KEY, "1"); } catch { /* private mode */ }
                setPhase("starting");
              }}
              className="rounded-full px-6 h-12 bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onFallback}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Pick from library instead
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

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

  // ── Preview / review beat ── After the customer taps the
  // shutter, instead of immediately handing off to onCapture we
  // show the captured photo full-screen with Use / Retake CTAs.
  // AI quality check (verify-shot-photo) runs in the background
  // and surfaces a non-blocking warning banner if the photo
  // looks off — customer can override and use anyway.
  if (previewFile && previewUrl) {
    const showWarning = verification && !verification.ok;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] bg-black"
        role="dialog"
        aria-label={`Review ${shotLabel} photo`}
      >
        {/* The photo, full-bleed. object-contain so portrait /
            landscape both read without cropping. */}
        <img
          src={previewUrl}
          alt={`${shotLabel} preview`}
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Top chrome — same close affordance as the camera view
            so the customer can bail to library or cancel without
            having to retake first. */}
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
              Review {shotLabel}
            </p>
            <p className="text-[12px] text-white/80 mt-0.5">
              Looks good? Use it. Otherwise, retake.
            </p>
          </div>
          <div className="w-10 h-10" aria-hidden="true" />
        </div>

        {/* AI verification status — verifying spinner + result
            banner. Banner is amber for soft warnings, red feel
            avoided so the customer doesn't think their offer is
            in trouble. Only renders once we have a result OR
            we're explicitly verifying. */}
        <AnimatePresence>
          {showWarning && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-0 right-0 top-[88px] flex justify-center px-5"
            >
              <div className="inline-flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-500/95 text-zinc-900 text-sm font-semibold shadow-xl max-w-md">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-px" aria-hidden="true" />
                <div className="space-y-0.5">
                  <p className="leading-tight">We couldn't read this clearly.</p>
                  <p className="text-xs font-medium opacity-90 leading-snug">
                    {verification?.hint ||
                      "Try again with better framing — the AI needs to see it clearly to bump your offer."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
          {verifying && !verification && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-0 right-0 top-[88px] flex justify-center px-5"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 text-white/85 text-[12px] font-medium backdrop-blur">
                <RotateCcw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                Checking your photo…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom chrome — Retake (left, ghosted) + Use this photo
            (right, primary). Layout mirrors iOS Photos confirm
            screen. Use is always enabled — verification is
            advisory; the customer's call wins. */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-6 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={handleRetakePreview}
              className="flex-1 h-14 rounded-full bg-white/10 text-white border border-white/30 font-semibold inline-flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Retake
            </button>
            <button
              type="button"
              onClick={handleAcceptPreview}
              className="flex-1 h-14 rounded-full bg-white text-zinc-900 font-semibold inline-flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              Use this photo
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Silhouette stroke color derives from the brightness sampler:
  //   too dark        → amber (matches the "too dark" banner)
  //   bright + ready  → emerald (matches the receipt accent)
  //   else (warming)  → white  (default)
  // Keeps the overlay itself a feedback signal, not a static guide.
  const silhouetteState: SilhouetteState =
    luma === null || !ready
      ? "neutral"
      : luma < LUMA_DARK_BANNER
        ? "warn"
        : "ok";

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
        <ShotSilhouette
          shotKey={shotKey}
          state={silhouetteState}
          className="w-full max-w-[440px] h-auto opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
        />
      </div>

      {/* Brightness warning — shows up to ~2cm above the shutter
          when the live frame's average luma is below threshold.
          Doesn't disable capture (algorithm can misfire) but
          tells the customer the AI will struggle. Pulses if it's
          really dark so it can't be missed. */}
      {ready && luma !== null && luma < LUMA_DARK_BANNER && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-0 right-0 bottom-[180px] flex justify-center pointer-events-none px-6"
        >
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/95 text-zinc-900 text-xs font-semibold shadow-lg ${
              luma < LUMA_DARK_FLOOR ? "animate-pulse" : ""
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" aria-hidden="true" />
            Too dark — try with more light
          </div>
        </motion.div>
      )}

      {/* Capture flash — fires for ~90ms on shutter so the
          customer feels the click even before the canvas finishes
          encoding. White overlay at high opacity + transition off. */}
      <motion.div
        initial={false}
        animate={{ opacity: flashing ? 0.85 : 0 }}
        transition={{ duration: 0.09, ease: "easeOut" }}
        className="absolute inset-0 bg-white pointer-events-none"
        aria-hidden="true"
      />

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

