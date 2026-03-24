import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X, RotateCcw, Check, FlipHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type DocDimensions } from "@/lib/documentDimensions";

interface DocumentCameraCaptureProps {
  docLabel: string;
  dimensions: DocDimensions;
  onCapture: (file: File, preview: string) => void;
  onClose: () => void;
}

const DocumentCameraCapture = ({
  docLabel,
  dimensions,
  onCapture,
  onClose,
}: DocumentCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      // Stop existing stream
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
  }, []); // intentionally exclude stream to avoid re-render loops

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
    // Convert data URL to File
    const byteString = atob(captured.split(",")[1]);
    const mimeString = captured.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const file = new File([blob], `${docLabel.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file, captured);
  };

  const handleRetake = () => {
    setCaptured(null);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Calculate guide frame dimensions to fit within viewport
  const { aspectRatio, orientation, sizeLabel } = dimensions;
  const isLandscape = orientation === "landscape";

  // Guide tips per doc type
  const tips = docLabel.toLowerCase().includes("license")
    ? "Lay flat on a dark surface · All text must be readable"
    : docLabel.toLowerCase().includes("title")
    ? "Lay flat · Ensure VIN and owner info are visible"
    : "Lay flat · Ensure all text is legible";

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
        <span className="text-white text-sm font-semibold">{docLabel}</span>
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

        {/* Guide overlay — only shown when camera is live */}
        {!captured && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dimmed edges */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Clear guide window */}
            <div
              className="relative z-10 border-2 border-white/80 rounded-lg"
              style={{
                width: isLandscape ? "85vw" : `${85 / aspectRatio}vw`,
                maxWidth: isLandscape ? "85vw" : "70vw",
                aspectRatio: String(aspectRatio),
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            >
              {/* Corner brackets */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-[3px] border-l-[3px] border-white rounded-tl-md" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-[3px] border-r-[3px] border-white rounded-tr-md" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-[3px] border-l-[3px] border-white rounded-bl-md" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-[3px] border-r-[3px] border-white rounded-br-md" />

              {/* Label */}
              <div className="absolute -top-8 left-0 right-0 text-center">
                <span className="text-white text-xs font-medium bg-black/60 px-2 py-0.5 rounded">
                  Align {docLabel} inside frame
                </span>
              </div>

              {/* Size label */}
              <div className="absolute -bottom-7 left-0 right-0 text-center">
                <span className="text-white/60 text-[10px]">{sizeLabel}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-black/80 px-4 py-2 text-center">
        <p className="text-white/70 text-xs">{tips}</p>
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 px-6 py-5 flex items-center justify-center gap-8">
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
            className="w-16 h-16 rounded-full bg-white border-4 border-white/30 hover:bg-white/90 transition-colors flex items-center justify-center"
            aria-label="Take photo"
          >
            <div className="w-12 h-12 rounded-full border-2 border-black/10" />
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default DocumentCameraCapture;
