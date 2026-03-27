import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, RotateCcw, Check, FlipHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

import overlayFront from "@/assets/overlays/front.png";
import overlayRear from "@/assets/overlays/rear.png";
import overlayDriverSide from "@/assets/overlays/driver-side.png";
import overlayPassengerSide from "@/assets/overlays/passenger-side.png";
import overlayDashboard from "@/assets/overlays/dashboard.png";
import overlayInterior from "@/assets/overlays/interior.png";
import overlayDamage from "@/assets/overlays/damage.png";

interface VehicleCameraCaptureProps {
  categoryId: string;
  categoryLabel: string;
  categoryDesc: string;
  onCapture: (file: File, preview: string) => void;
  onClose: () => void;
}

const OVERLAY_GUIDES: Record<string, { img: string; tip: string; aspectHint: string }> = {
  front: {
    tip: "Stand centered, 8–10 ft back · Full vehicle in frame",
    aspectHint: "landscape",
    img: overlayFront,
  },
  rear: {
    tip: "Stand centered · License plate must be readable",
    aspectHint: "landscape",
    img: overlayRear,
  },
  "driver-side": {
    tip: "Stand 6–8 ft away · Full side, ground to roof",
    aspectHint: "landscape",
    img: overlayDriverSide,
  },
  "passenger-side": {
    tip: "Stand 6–8 ft away · Full side, ground to roof",
    aspectHint: "landscape",
    img: overlayPassengerSide,
  },
  dashboard: {
    tip: "Show odometer reading clearly · Ignition on",
    aspectHint: "landscape",
    img: overlayDashboard,
  },
  interior: {
    tip: "Capture front seats, console, and steering wheel",
    aspectHint: "landscape",
    img: overlayInterior,
  },
  damage: {
    tip: "Get close — 1–2 ft · Focus on scratches, dents, or wear",
    aspectHint: "square",
    img: overlayDamage,
  },
};

const VehicleCameraCapture = ({
  categoryId,
  categoryLabel,
  categoryDesc,
  onCapture,
  onClose,
}: VehicleCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [showGuide, setShowGuide] = useState(true);

  const guide = OVERLAY_GUIDES[categoryId] || OVERLAY_GUIDES["front"];

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      stream?.getTracks().forEach((t) => t.stop());
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError("");
    } catch {
      setError("Unable to access camera. Please allow camera permissions or use the file upload option instead.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCaptured(dataUrl);
  };

  const handleConfirm = () => {
    if (!captured) return;
    const byteString = atob(captured.split(",")[1]);
    const mimeString = captured.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const file = new File([blob], `${categoryId}_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file, captured);
  };

  const handleRetake = () => setCaptured(null);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <div className="text-center text-white max-w-sm">
          <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-sm mb-4">{error}</p>
          <Button variant="outline" onClick={onClose} className="text-white border-white/30">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button onClick={onClose} className="text-white p-1">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <span className="text-white text-sm font-semibold block">{categoryLabel}</span>
          <span className="text-white/60 text-[11px]">{categoryDesc}</span>
        </div>
        <button onClick={toggleCamera} className="text-white p-1">
          <FlipHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Camera / Preview */}
      <div className="flex-1 relative overflow-hidden">
        {captured ? (
          <img src={captured} alt="Captured" className="w-full h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* Guide overlay */}
        {!captured && showGuide && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="relative z-10 animate-pulse"
              style={{
                width: guide.aspectHint === "square" ? "84vw" : "96vw",
                maxWidth: guide.aspectHint === "square" ? "420px" : "720px",
                aspectRatio: guide.aspectHint === "square" ? "1" : guide.aspectHint === "landscape" ? "16/10" : "10/16",
              }}
            >
              <img src={guide.img} alt={`${categoryLabel} alignment guide`} className="w-full h-full object-contain opacity-60" draggable={false} />
            </div>
          </div>
        )}
      </div>

      {/* Tips bar */}
      <div className="bg-black/80 px-4 py-2 flex items-center justify-between">
        <p className="text-white/70 text-xs flex-1">{guide.tip}</p>
        {!captured && (
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-white/50 text-[10px] font-medium ml-3 whitespace-nowrap"
          >
            {showGuide ? "Hide guide" : "Show guide"}
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 px-6 py-5 flex items-center justify-center gap-8 pb-safe">
        {captured ? (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleRetake}
              className="bg-transparent border-white/30 text-white hover:bg-white/10 gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Retake
            </Button>
            <Button
              size="lg"
              onClick={handleConfirm}
              className="bg-success hover:bg-success/90 text-white gap-2 px-8"
            >
              <Check className="w-5 h-5" />
              Use Photo
            </Button>
          </>
        ) : (
          <button
            onClick={handleCapture}
            className="w-[72px] h-[72px] rounded-full bg-white/90 border-[5px] border-white/30 hover:bg-white transition-colors flex items-center justify-center shadow-lg"
            aria-label="Take photo"
          >
            <div className="w-[56px] h-[56px] rounded-full border-2 border-black/10" />
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default VehicleCameraCapture;
