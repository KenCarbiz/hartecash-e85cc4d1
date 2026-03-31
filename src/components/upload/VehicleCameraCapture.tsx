import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw, Check, FlipHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import GhostCarSilhouette from "@/components/upload/GhostCarSilhouette";
import type { VehicleArchetype } from "@/lib/vehicleArchetypes";

const OVERLAY_COLORS = ["#00FF88", "#FF3B3B", "#FFFFFF"];

interface VehicleCameraCaptureProps {
  categoryId: string;
  categoryLabel: string;
  categoryDesc: string;
  vehicleArchetype?: VehicleArchetype;
  defaultOverlayColor?: string;
  allowColorChange?: boolean;
  onCapture: (file: File, preview: string) => void;
  onClose: () => void;
}

const VehicleCameraCapture = ({
  categoryId,
  categoryLabel,
  categoryDesc,
  vehicleArchetype = "sedan",
  defaultOverlayColor = "#00FF88",
  allowColorChange = true,
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
  const [colorIdx, setColorIdx] = useState(0);
  const [viewfinderSize, setViewfinderSize] = useState({ w: 480, h: 270 });

  const overlayColor = OVERLAY_COLORS[colorIdx];

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      stream?.getTracks().forEach((t) => t.stop());
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError("");
    } catch {
      setError("Unable to access camera. Please allow camera permissions or use the file upload option instead.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure viewfinder area
  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth, 720);
      const h = Math.round(w * 9 / 16);
      setViewfinderSize({ w, h });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
  };

  const handleConfirm = () => {
    if (!captured) return;
    const byteString = atob(captured.split(",")[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: "image/jpeg" });
    const file = new File([blob], `${categoryId}_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file, captured);
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6">
        <div className="text-center text-white max-w-sm">
          <p className="text-sm mb-4">{error}</p>
          <Button variant="outline" onClick={onClose} className="text-white border-white/30">Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button onClick={onClose} className="text-white p-1"><X className="w-6 h-6" /></button>
        <div className="text-center">
          <span className="text-white text-sm font-semibold block">{categoryLabel}</span>
          <span className="text-white/60 text-[11px]">{categoryDesc}</span>
        </div>
        <button onClick={() => setFacingMode(p => p === "environment" ? "user" : "environment")} className="text-white p-1">
          <FlipHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Camera / Preview */}
      <div className="flex-1 relative overflow-hidden">
        {captured ? (
          <img src={captured} alt="Captured" className="w-full h-full object-contain" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {/* GhostCar SVG overlay */}
            {showGuide && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative" style={{ width: viewfinderSize.w, height: viewfinderSize.h }}>
                  <GhostCarSilhouette
                    archetype={vehicleArchetype}
                    shotId={categoryId}
                    color={overlayColor}
                    width={viewfinderSize.w}
                    height={viewfinderSize.h}
                  />
                  {/* Corner brackets */}
                  {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([r, b], i) => (
                    <div key={i} className="absolute w-6 h-6" style={{
                      [r ? "right" : "left"]: 4,
                      [b ? "bottom" : "top"]: 4,
                      borderColor: overlayColor,
                      borderWidth: 2,
                      [r ? "borderLeft" : "borderRight"]: "none",
                      [b ? "borderTop" : "borderBottom"]: "none",
                      opacity: 0.5,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tips + color picker + guide toggle */}
      <div className="bg-black/80 px-4 py-2 flex items-center justify-between">
        <p className="text-white/70 text-xs flex-1">{categoryDesc}</p>
        <div className="flex items-center gap-2 ml-3">
          {/* Overlay color picker */}
          {!captured && showGuide && (
            <div className="flex gap-1.5">
              {OVERLAY_COLORS.map((c, i) => (
                <button key={c} onClick={() => setColorIdx(i)}
                  className="w-4 h-4 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: colorIdx === i ? "#fff" : "transparent" }}
                />
              ))}
            </div>
          )}
          {!captured && (
            <button onClick={() => setShowGuide(!showGuide)}
              className="text-white/50 text-[10px] font-medium whitespace-nowrap ml-2">
              {showGuide ? "Hide guide" : "Show guide"}
            </button>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 px-6 py-5 flex items-center justify-center gap-8 pb-safe">
        {captured ? (
          <>
            <Button variant="outline" size="lg" onClick={() => setCaptured(null)}
              className="bg-transparent border-white/30 text-white hover:bg-white/10 gap-2">
              <RotateCcw className="w-5 h-5" /> Retake
            </Button>
            <Button size="lg" onClick={handleConfirm}
              className="bg-success hover:bg-success/90 text-white gap-2 px-8">
              <Check className="w-5 h-5" /> Use Photo
            </Button>
          </>
        ) : (
          <button onClick={handleCapture}
            className="w-[72px] h-[72px] rounded-full bg-white/90 border-[5px] border-white/30 hover:bg-white transition-colors flex items-center justify-center shadow-lg"
            aria-label="Take photo">
            <div className="w-[56px] h-[56px] rounded-full border-2 border-black/10" />
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default VehicleCameraCapture;
