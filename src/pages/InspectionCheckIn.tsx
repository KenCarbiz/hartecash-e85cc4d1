import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ArrowLeft,
  CheckCircle2,
  User,
  Gauge,
  Zap,
  Loader2,
  ScanLine,
  AlertCircle,
  Keyboard,
  Car,
  ArrowRight,
  RefreshCw,
  Phone,
  Mail,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import SEO from "@/components/SEO";
import CustomerLookupPanel from "@/components/checkin/CustomerLookupPanel";

type Stage = "capture" | "lookup" | "create";

type ExistingSubmission = {
  id: string;
  token: string;
  name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  progress_status: string | null;
  mileage: string | null;
  phone: string | null;
  email: string | null;
  assigned_rep_email?: string | null;
};

type BBData = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  wholesale?: { avg?: number | null };
  tradein?: { avg?: number | null };
  retail?: { avg?: number | null };
};

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;
// Accept either a full 17-char VIN (for new-customer check-in via lookup +
// create) OR the last 6 characters (quick jump when the submission already
// exists). Staff mostly use last-6 because the 17-char VIN is inconvenient
// to type and the barcode scanner handles the full one anyway.
const LAST6_REGEX = /^[A-HJ-NPR-Z0-9]{6}$/;

const isValidVin = (vin: string) => VIN_REGEX.test(vin.toUpperCase());
const isLast6 = (v: string) => LAST6_REGEX.test(v.toUpperCase());

const InspectionCheckIn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();

  // Auth
  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  // Stage
  const [stage, setStage] = useState<Stage>("capture");

  // VIN capture
  const [vin, setVin] = useState("");
  const [manualVin, setManualVin] = useState("");
  // When the staff enters a last-6 that matches more than one submission,
  // we show an inline picker so they choose the right one before we route
  // to /inspection/:id.
  const [last6Matches, setLast6Matches] = useState<ExistingSubmission[] | null>(null);
  const [last6Looking, setLast6Looking] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string>("");
  // scannerMode: "native" = Chromium BarcodeDetector; "zxing" = JS fallback
  // used for every other browser (Safari desktop + iOS, Firefox, etc.)
  const [scannerMode, setScannerMode] = useState<"native" | "zxing" | null>(null);
  // Landscape nudge — VIN barcodes are long and horizontal; scans are
  // 3-5x faster when the phone is turned sideways. We soft-prompt users
  // in portrait mode and auto-dismiss the overlay once they rotate.
  const [isPortrait, setIsPortrait] = useState<boolean>(
    typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectLoopRef = useRef<number | null>(null);
  // Holds the ZXing reader instance when running the JS fallback so we
  // can reset() it on stopScanner without re-importing the module.
  const zxingReaderRef = useRef<{ reset: () => void } | null>(null);

  // Lookup
  const [lookupLoading, setLookupLoading] = useState(false);
  const [existing, setExisting] = useState<ExistingSubmission | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  // BB / vehicle (for new submission)
  const [bbLoading, setBbLoading] = useState(false);
  const [bbData, setBbData] = useState<BBData | null>(null);
  const [bbError, setBbError] = useState("");

  // Quick create form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mileage, setMileage] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }
      setUserEmail(session.user.email || "");
      setAuthChecked(true);
    };
    checkAuth();
  }, [navigate]);

  // ── Cleanup camera on unmount ──
  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Orientation tracking ──
  // VIN barcodes are long and horizontal — scans are dramatically faster
  // in landscape because the viewfinder width aligns with the barcode's
  // long axis. We watch window resize + screen.orientation.change events
  // and update isPortrait so the scanner overlay can show a soft prompt
  // until the user rotates.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    // screen.orientation.change is cleaner than resize on modern phones
    // because it fires exactly once per rotation, not on every keyboard
    // reflow. Not all browsers expose it (looking at you, older iOS), so
    // we addEventListener guardedly and silently skip if it's missing.
    const orient = (screen as any).orientation;
    if (orient && typeof orient.addEventListener === "function") {
      orient.addEventListener("change", checkOrientation);
    }
    return () => {
      window.removeEventListener("resize", checkOrientation);
      if (orient && typeof orient.removeEventListener === "function") {
        orient.removeEventListener("change", checkOrientation);
      }
    };
  }, []);

  // ── Best-effort landscape lock when the scanner opens ──
  // screen.orientation.lock() works on Chrome Android; Safari iOS only
  // honors it inside a fullscreen element. We try it after scannerOpen
  // flips true and silently fail if the user's browser doesn't support
  // it — the soft overlay handles the UX regardless.
  useEffect(() => {
    if (!scannerOpen) return;
    const orient = (screen as any).orientation;
    if (orient && typeof orient.lock === "function") {
      orient.lock("landscape").catch(() => {
        // Ignore — we fall back to the soft overlay prompt
      });
    }
    return () => {
      const o = (screen as any).orientation;
      if (o && typeof o.unlock === "function") {
        try { o.unlock(); } catch { /* ignore */ }
      }
    };
  }, [scannerOpen]);

  const stopScanner = useCallback(() => {
    if (detectLoopRef.current !== null) {
      cancelAnimationFrame(detectLoopRef.current);
      detectLoopRef.current = null;
    }
    // Tell the ZXing reader to stop its own decode loop. Calling reset()
    // also releases any internal references to the video element so GC
    // can reclaim it.
    if (zxingReaderRef.current) {
      try { zxingReaderRef.current.reset(); } catch { /* ignore */ }
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerMode(null);
  }, []);

  const handleVinCaptured = useCallback(
    async (capturedVin: string) => {
      const cleanVin = capturedVin.trim().toUpperCase();
      if (!isValidVin(cleanVin)) {
        toast({
          title: "Invalid VIN",
          description: "VIN must be 17 characters (no I, O, or Q).",
          variant: "destructive",
        });
        return;
      }
      setVin(cleanVin);
      stopScanner();
      setScannerOpen(false);
      setStage("lookup");

      // Perform lookup
      setLookupLoading(true);
      setExisting(null);
      setLookupDone(false);
      try {
        const { data, error } = await supabase
          .from("submissions")
          .select(
            "id, token, name, vehicle_year, vehicle_make, vehicle_model, progress_status, mileage, phone, email"
          )
          .eq("vin", cleanVin)
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (error) {
          console.error("Lookup error:", error);
        }
        if (data) {
          setExisting(data as ExistingSubmission);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLookupLoading(false);
        setLookupDone(true);
      }
    },
    [stopScanner, toast]
  );

  // Try to extract a valid 17-char VIN substring from whatever the
  // decoder returned (Code 39 scans often include start/stop delimiters
  // or extra padding characters).
  const extractVinFromBarcode = (raw: string): string | null => {
    const cleaned = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length >= 17) {
      for (let i = 0; i <= cleaned.length - 17; i++) {
        const slice = cleaned.slice(i, i + 17);
        if (isValidVin(slice)) return slice;
      }
    }
    return null;
  };

  const startScanner = async () => {
    setScannerError("");
    setScannerOpen(true);

    // Step 1: open the camera. Both the native BarcodeDetector path
    // and the ZXing fallback need a live <video> source, so we open
    // the stream first and branch on the decoder afterwards.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
    } catch (err: any) {
      console.error(err);
      setScannerError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access or use manual entry."
          : err?.name === "NotFoundError"
          ? "No camera detected on this device. Use manual entry below."
          : err?.name === "NotReadableError"
          ? "Another app is using the camera. Close it and try again, or use manual entry."
          : "Could not start the camera. Please try manual entry."
      );
      stopScanner();
      return;
    }

    streamRef.current = stream;
    // Wait a tick so video element is mounted by the re-render
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // iOS Safari requires playsInline + muted (already set in JSX)
      // AND a play() call after srcObject is assigned.
      await videoRef.current.play().catch(() => {
        /* autoplay may fail silently; the user gesture that opened the
         * scanner usually satisfies the autoplay policy */
      });
    }

    // Step 2: pick the fastest decoder available.
    // - Chrome/Edge on desktop + Android: native BarcodeDetector (zero download)
    // - Everything else (Safari desktop + iOS, Firefox, all iOS browsers
    //   because WebKit doesn't ship the Shape Detection API): dynamic
    //   import of @zxing/browser as a pure-JS fallback. ZXing supports
    //   Code 39 and Code 128, which is what VIN door-jamb stickers use.
    if ("BarcodeDetector" in window) {
      try {
        setScannerMode("native");
        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({ formats: ["code_39", "code_128"] });

        const detect = async () => {
          if (!videoRef.current || !streamRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            for (const barcode of barcodes) {
              const candidate = extractVinFromBarcode(String(barcode.rawValue || ""));
              if (candidate) {
                handleVinCaptured(candidate);
                return;
              }
            }
          } catch {
            // Detector can throw transient errors - keep trying
          }
          detectLoopRef.current = requestAnimationFrame(detect);
        };
        detectLoopRef.current = requestAnimationFrame(detect);
        return;
      } catch (err) {
        // If the native detector constructor throws (rare), fall through
        // to the ZXing path instead of dead-ending.
        console.warn("Native BarcodeDetector failed, falling back to ZXing:", err);
      }
    }

    // Pure-JS fallback via @zxing/browser. Dynamically imported so
    // Chromium users never pay the download cost.
    try {
      setScannerMode("zxing");
      const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_128,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      zxingReaderRef.current = reader as unknown as { reset: () => void };

      if (!videoRef.current) {
        throw new Error("Video element not mounted");
      }

      // decodeFromVideoElement attaches to the <video> we already have
      // playing the MediaStream, so we don't hand ZXing a second device.
      // The callback fires on every successful decode; we bail after
      // the first valid VIN.
      let handled = false;
      await reader.decodeFromVideoElement(
        videoRef.current,
        (result, _err) => {
          if (handled || !result) return;
          const candidate = extractVinFromBarcode(result.getText());
          if (candidate) {
            handled = true;
            handleVinCaptured(candidate);
          }
        }
      );
    } catch (err) {
      console.error("ZXing fallback failed:", err);
      setScannerError(
        "Could not start the barcode scanner. Please enter the VIN manually below."
      );
      stopScanner();
    }
  };

  const closeScanner = () => {
    stopScanner();
    setScannerOpen(false);
  };

  const handleManualContinue = async () => {
    const cleaned = manualVin.trim().toUpperCase();

    // Path A — full 17-char VIN: existing lookup + create-new flow.
    if (isValidVin(cleaned)) {
      handleVinCaptured(cleaned);
      return;
    }

    // Path B — last 6: quick jump to existing submission's inspection.
    if (isLast6(cleaned)) {
      setLast6Looking(true);
      setLast6Matches(null);
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, token, name, vehicle_year, vehicle_make, vehicle_model, progress_status, mileage, phone, email",
        )
        .ilike("vin", `%${cleaned}`)
        .eq("dealership_id", tenant.dealership_id)
        .order("created_at", { ascending: false })
        .limit(5);
      setLast6Looking(false);

      if (error) {
        toast({ title: "Lookup failed", description: error.message, variant: "destructive" });
        return;
      }
      const rows = (data as ExistingSubmission[]) || [];
      if (rows.length === 0) {
        toast({
          title: "No matching customer",
          description: "No submission found for that last-6. Enter the full 17-character VIN to start a new check-in.",
          variant: "destructive",
        });
        return;
      }
      if (rows.length === 1) {
        navigate(`/inspection/${rows[0].id}`);
        return;
      }
      // Multiple — show inline picker
      setLast6Matches(rows);
      return;
    }

    toast({
      title: "Invalid VIN",
      description: "Enter the full 17-character VIN or the last 6 digits.",
      variant: "destructive",
    });
  };

  const resetAll = () => {
    setStage("capture");
    setVin("");
    setManualVin("");
    setLast6Matches(null);
    setLast6Looking(false);
    setExisting(null);
    setLookupDone(false);
    setBbData(null);
    setBbError("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setMileage("");
  };

  // ── BB Lookup ──
  const handleBBLookup = async () => {
    setBbLoading(true);
    setBbError("");
    setBbData(null);
    try {
      const { data, error } = await supabase.functions.invoke("bb-lookup", {
        body: {
          lookup_type: "vin",
          vin,
          mileage: 0,
          state: "CT",
        },
      });
      if (error || data?.error || !data?.vehicles?.length) {
        setBbError("Could not decode this VIN. You can still create the record manually.");
        setBbLoading(false);
        return;
      }
      const v = data.vehicles[0];
      setBbData({
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.series || v.style || "",
        wholesale: v.wholesale,
        tradein: v.tradein,
        retail: v.retail,
      });
      setStage("create");
    } catch (err) {
      console.error(err);
      setBbError("Lookup failed. Please try again.");
    } finally {
      setBbLoading(false);
    }
  };

  // ── Create walk-in submission ──
  const handleCreateWalkIn = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Missing information",
        description: "First name and last name are required.",
        variant: "destructive",
      });
      return;
    }
    if (!mileage.trim()) {
      toast({
        title: "Missing mileage",
        description: "Please enter the current mileage.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const generatedToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const insertPayload: Record<string, any> = {
        token: generatedToken,
        vin,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone || null,
        email: email || null,
        mileage,
        vehicle_year: bbData?.year || null,
        vehicle_make: bbData?.make || null,
        vehicle_model: bbData?.model || null,
        lead_source: "walk_in",
        progress_status: "inspection_scheduled",
        dealership_id: tenant.dealership_id,
        bb_wholesale_avg: bbData?.wholesale?.avg ?? null,
        bb_tradein_avg: bbData?.tradein?.avg ?? null,
        bb_retail_avg: bbData?.retail?.avg ?? null,
        estimated_offer_high: bbData?.tradein?.avg ?? null,
        status_updated_by: session?.user?.email || null,
        internal_notes: `Walk-in created via Inspection Check-In by ${session?.user?.email || "staff"}`,
      };

      const { error } = await supabase
        .from("submissions")
        .insert(insertPayload as any);
      if (error) throw error;

      const { data: inserted } = await supabase
        .from("submissions")
        .select("id")
        .eq("token", generatedToken)
        .maybeSingle();

      toast({
        title: "Walk-in created",
        description: "Opening inspection sheet...",
      });

      if (inserted?.id) {
        navigate(`/inspection/${inserted.id}`);
      } else {
        navigate("/admin");
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Could not create walk-in",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // ── Render guards ──
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Full-screen scanner overlay ──
  if (scannerOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          {/* Overlay frame */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-[88%] max-w-md aspect-[3/1] border-4 border-white/90 rounded-2xl shadow-2xl relative">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-2xl" />
              {/* Scan line */}
              <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-primary shadow-[0_0_12px_rgba(100,160,255,0.9)] animate-pulse" />
            </div>
            <p className="mt-6 text-white/90 text-base font-semibold text-center px-6">
              Align VIN barcode within the frame
            </p>
            <p className="mt-1 text-white/60 text-xs text-center px-6">
              Found on the driver-side door jamb sticker
            </p>
          </div>
        </div>

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 pointer-events-none">
          <Button
            variant="secondary"
            size="sm"
            onClick={closeScanner}
            className="pointer-events-auto h-11 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20"
          >
            <X className="w-4 h-4 mr-1.5" /> Cancel
          </Button>
          <div className="pointer-events-auto px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold border border-white/20 flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5" />
            {scannerMode === "zxing" ? "Scanning (compat mode)…" : "Scanning…"}
          </div>
        </div>

        {/* Landscape nudge — VIN barcodes scan 3-5x faster sideways.
            We show this soft prompt when the phone is in portrait, and
            it auto-dismisses the moment the user rotates. On iOS where
            orientation.lock() needs fullscreen, the prompt is the whole
            UX; on Chrome Android the lock usually kicks in immediately
            and the prompt never flashes. */}
        {isPortrait && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-6">
            <div className="relative mb-6">
              {/* Animated phone rotation icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 100 100"
                className="w-24 h-24 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="30"
                  y="10"
                  width="40"
                  height="80"
                  rx="6"
                  className="origin-center"
                  style={{
                    animation: "vin-phone-rotate 2s ease-in-out infinite",
                    transformOrigin: "50px 50px",
                  }}
                />
                <circle cx="50" cy="80" r="2" fill="currentColor" />
              </svg>
              <style>{`
                @keyframes vin-phone-rotate {
                  0%, 20% { transform: rotate(0deg); }
                  60%, 100% { transform: rotate(-90deg); }
                }
              `}</style>
            </div>
            <h3 className="text-white text-xl font-bold text-center mb-2">
              Turn your phone sideways
            </h3>
            <p className="text-white/70 text-sm text-center max-w-xs leading-relaxed">
              VIN barcodes scan much faster in landscape. Rotate your device
              and we'll start scanning automatically.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeScanner}
              className="mt-8 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
          </div>
        )}

        {scannerError && (
          <div className="absolute bottom-8 inset-x-6 bg-destructive/90 text-destructive-foreground rounded-2xl p-4 text-sm font-medium shadow-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{scannerError}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Main UI ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <SEO title="Inspection Check-In" />

      {/* Header */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-md">
              <ScanLine className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                Inspection Check-In
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {tenant.display_name} · {userEmail}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* ─── STAGE 1: VIN CAPTURE ─── */}
        {stage === "capture" && (
          <>
            <div className="text-center mb-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
                Inspection Check-In
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base px-4">
                Scan the VIN barcode on the driver-side door, enter it manually, or look up by name / phone / email
              </p>
            </div>

            {/* Receptionist / front-desk multi-field search. Covers the
                 walk-in who doesn't want to hand over their driver's
                 license yet — type whatever they can give you. */}
            <CustomerLookupPanel
              onPick={(m) => {
                // Same routing as a VIN hit — jump into the inspection
                // workflow so downstream notify / send-to-appraiser /
                // open actions stay consistent.
                navigate(`/inspection/${m.id}`);
              }}
            />

            {/* Option A — Camera */}
            <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Scan with Camera</h3>
                  <p className="text-xs text-muted-foreground">
                    Fastest — point at the door-jamb barcode
                  </p>
                </div>
              </div>
              <Button
                onClick={startScanner}
                className="w-full h-16 text-base font-bold shadow-lg"
                size="lg"
              >
                <ScanLine className="w-6 h-6 mr-2" />
                Scan VIN Barcode
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Works on Safari, Chrome, Firefox, and every iPhone browser.
              </p>
              {scannerError && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{scannerError}</span>
                </div>
              )}
            </section>

            {/* Option B — Manual Entry */}
            <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Keyboard className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Manual Entry</h3>
                  <p className="text-xs text-muted-foreground">
                    Full 17-character VIN, or last 6 digits if the customer is already on file
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="manualVin" className="text-sm font-semibold mb-2 block">
                    VIN <span className="text-muted-foreground font-normal">or last 6</span>
                  </Label>
                  <Input
                    id="manualVin"
                    value={manualVin}
                    onChange={(e) => {
                      const v = e.target.value
                        .toUpperCase()
                        .replace(/[^A-HJ-NPR-Z0-9]/g, "")
                        .slice(0, 17);
                      setManualVin(v);
                      // Clear stale picker if the user keeps typing
                      if (last6Matches) setLast6Matches(null);
                    }}
                    placeholder="17-character VIN or last 6 digits"
                    maxLength={17}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    className="h-14 text-lg font-mono tracking-wider"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {manualVin.length === 17 ? (
                      <>17/17 · Full VIN — ready to look up or create</>
                    ) : manualVin.length === 6 ? (
                      <>6/6 · Last-6 — will jump to the matching inspection</>
                    ) : (
                      <>{manualVin.length}/17 · No I, O, or Q · or type last 6</>
                    )}
                  </p>
                </div>
                <Button
                  onClick={handleManualContinue}
                  disabled={!(manualVin.length === 17 || manualVin.length === 6) || last6Looking}
                  className="w-full h-14 text-base font-bold"
                  size="lg"
                >
                  {last6Looking ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Looking up…
                    </>
                  ) : (
                    <>
                      {manualVin.length === 6 ? "Find inspection" : "Continue"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                {/* Multi-match picker — shown when the last-6 lookup
                    returned more than one submission and the staff has
                    to pick which vehicle they're checking in. */}
                {last6Matches && last6Matches.length > 1 && (
                  <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Multiple matches — pick the right one
                    </p>
                    <ul className="space-y-1.5">
                      {last6Matches.map((m) => {
                        const veh =
                          [m.vehicle_year, m.vehicle_make, m.vehicle_model]
                            .filter(Boolean)
                            .join(" ") || "Vehicle on file";
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/inspection/${m.id}`)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left"
                            >
                              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Car className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-card-foreground truncate">
                                  {veh}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {m.name || "Unknown customer"}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* ─── STAGE 2: LOOKUP RESULT ─── */}
        {stage === "lookup" && (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={resetAll}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Scan another VIN
              </button>
              <div className="text-xs text-muted-foreground font-mono">
                {vin}
              </div>
            </div>

            {lookupLoading && (
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-10 shadow-lg text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  Looking up submission...
                </p>
              </div>
            )}

            {!lookupLoading && lookupDone && existing && (
              <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      Found existing submission
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      This vehicle is already in the system
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-background/60 border border-border/40 p-4 space-y-3 mb-5">
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Customer
                      </p>
                      <p className="text-base font-bold text-foreground">
                        {existing.name || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Car className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Vehicle
                      </p>
                      <p className="text-base font-bold text-foreground">
                        {existing.vehicle_year} {existing.vehicle_make}{" "}
                        {existing.vehicle_model}
                      </p>
                    </div>
                  </div>
                  {existing.progress_status && (
                    <div className="flex items-start gap-3">
                      <Zap className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                          {existing.progress_status}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => navigate(`/inspection/${existing.id}`)}
                    className="w-full h-14 text-base font-bold shadow-lg"
                    size="lg"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Start Inspection
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={async () => {
                        const rep = existing.assigned_rep_email;
                        if (!rep) {
                          toast({ title: "No sales rep assigned", description: "Assign a rep from the customer file first.", variant: "destructive" });
                          return;
                        }
                        // F1 fix: Reception hitting "Notify Sales Rep"
                        // used to only write activity_log — nothing
                        // actually pinged the rep. Now we look up the
                        // rep's phone + email from user_roles and fire
                        // a direct staff_customer_arrived notification.
                        const { data: repRow } = await (supabase as any)
                          .from("user_roles")
                          .select("phone, email")
                          .eq("email", rep)
                          .maybeSingle();
                        await supabase.functions.invoke("send-notification", {
                          body: {
                            trigger_key: "staff_customer_arrived",
                            submission_id: existing.id,
                            recipient_phone: (repRow as any)?.phone || undefined,
                            recipient_email: rep,
                          },
                        }).catch(() => {});
                        await supabase.from("activity_log").insert({
                          submission_id: existing.id,
                          action: "Customer Arrived",
                          old_value: null,
                          new_value: `Notified ${rep}`,
                          performed_by: userEmail || "reception",
                        } as any);
                        toast({ title: "Rep notified", description: `${rep} has been texted.` });
                      }}
                      variant="outline"
                      className="h-12 text-sm font-semibold"
                    >
                      <Phone className="w-4 h-4 mr-1.5" />
                      Notify Sales Rep
                    </Button>
                    <Button
                      onClick={async () => {
                        const { error } = await supabase
                          .from("submissions")
                          .update({ needs_appraisal: true } as any)
                          .eq("id", existing.id);
                        if (error) {
                          toast({ title: "Could not flag", description: error.message, variant: "destructive" });
                          return;
                        }
                        await supabase.from("activity_log").insert({
                          submission_id: existing.id,
                          action: "Flagged for Appraiser",
                          old_value: null,
                          new_value: "Customer arrived at check-in",
                          performed_by: userEmail || "reception",
                        } as any);
                        toast({ title: "Sent to appraiser", description: "Lead flagged for the appraiser queue." });
                      }}
                      variant="outline"
                      className="h-12 text-sm font-semibold"
                    >
                      <User className="w-4 h-4 mr-1.5" />
                      Send to Appraiser
                    </Button>
                  </div>
                  <Button
                    onClick={() => navigate("/admin")}
                    variant="ghost"
                    className="w-full h-10 text-xs font-medium text-muted-foreground"
                  >
                    Open Customer File
                  </Button>
                </div>
              </section>
            )}

            {!lookupLoading && lookupDone && !existing && (
              <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Car className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      New vehicle
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Not yet in system — let's get it set up
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-background/60 border border-border/40 p-4 mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Scanned VIN
                  </p>
                  <p className="text-lg font-mono tracking-wider font-bold text-foreground break-all">
                    {vin}
                  </p>
                </div>

                {bbError && (
                  <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{bbError}</span>
                  </div>
                )}

                <Button
                  onClick={handleBBLookup}
                  disabled={bbLoading}
                  className="w-full h-14 text-base font-bold shadow-lg"
                  size="lg"
                >
                  {bbLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Decoding vehicle...
                    </>
                  ) : (
                    <>
                      <Car className="w-5 h-5 mr-2" />
                      Look Up Vehicle
                    </>
                  )}
                </Button>
              </section>
            )}
          </>
        )}

        {/* ─── STAGE 3: QUICK-CREATE WALK-IN ─── */}
        {stage === "create" && bbData && (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={resetAll}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" /> Scan another VIN
              </button>
              <div className="text-xs text-muted-foreground font-mono">
                {vin}
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-extrabold text-foreground mb-1">
                Walk-In Customer
              </h2>
              <p className="text-muted-foreground text-sm">
                Quick create to start inspection
              </p>
            </div>

            {/* Decoded vehicle */}
            <section className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/30 rounded-3xl p-5 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Decoded Vehicle
                  </p>
                  <p className="text-lg font-bold text-foreground truncate">
                    {bbData.year} {bbData.make} {bbData.model}
                  </p>
                  {bbData.trim && (
                    <p className="text-xs text-muted-foreground truncate">{bbData.trim}</p>
                  )}
                </div>
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              </div>
            </section>

            {/* Form */}
            <section className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Customer Info</h3>
                  <p className="text-xs text-muted-foreground">
                    Required fields marked with *
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-semibold mb-2 block">
                      First Name *
                    </Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="h-14 text-base"
                      autoCapitalize="words"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-semibold mb-2 block">
                      Last Name *
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="h-14 text-base"
                      autoCapitalize="words"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-semibold mb-2 block">
                    Phone Number{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="h-14 text-lg pl-12"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="mileage" className="text-sm font-semibold mb-2 block">
                    Current Mileage *
                  </Label>
                  <div className="relative">
                    <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="mileage"
                      type="tel"
                      inputMode="numeric"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="e.g. 48500"
                      className="h-14 text-lg pl-12"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-semibold mb-2 block">
                    Email{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="h-14 text-lg pl-12"
                      autoCapitalize="none"
                    />
                  </div>
                </div>
              </div>
            </section>

            <Button
              onClick={handleCreateWalkIn}
              disabled={creating}
              className="w-full h-16 text-lg font-bold shadow-lg"
              size="lg"
            >
              {creating ? (
                <>
                  <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create & Start Inspection
                  <ArrowRight className="w-6 h-6 ml-2" />
                </>
              )}
            </Button>
          </>
        )}
      </main>
    </div>
  );
};

export default InspectionCheckIn;
