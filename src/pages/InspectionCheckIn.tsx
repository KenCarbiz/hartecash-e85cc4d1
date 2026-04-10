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

const isValidVin = (vin: string) => VIN_REGEX.test(vin.toUpperCase());

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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string>("");
  const [barcodeSupported, setBarcodeSupported] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectLoopRef = useRef<number | null>(null);

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

  // ── BarcodeDetector support check ──
  useEffect(() => {
    setBarcodeSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  // ── Cleanup camera on unmount ──
  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = useCallback(() => {
    if (detectLoopRef.current !== null) {
      cancelAnimationFrame(detectLoopRef.current);
      detectLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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

  const startScanner = async () => {
    setScannerError("");
    if (!("BarcodeDetector" in window)) {
      setBarcodeSupported(false);
      setScannerError(
        "Your browser doesn't support barcode scanning. Please enter the VIN manually below."
      );
      return;
    }
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      // Wait a tick so video element is mounted
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {
          /* autoplay may fail silently on some browsers */
        });
      }

      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["code_39", "code_128"] });

      const detect = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          for (const barcode of barcodes) {
            const raw = (barcode.rawValue || "").toString().toUpperCase();
            // Some Code 39 scans include "I" delimiter or start/stop characters - strip
            const cleaned = raw.replace(/[^A-Z0-9]/g, "");
            // VIN could be surrounded by padding; look for a 17-char substring
            if (cleaned.length >= 17) {
              for (let i = 0; i <= cleaned.length - 17; i++) {
                const slice = cleaned.slice(i, i + 17);
                if (isValidVin(slice)) {
                  handleVinCaptured(slice);
                  return;
                }
              }
            }
          }
        } catch (err) {
          // Detector can throw transient errors - keep trying
        }
        detectLoopRef.current = requestAnimationFrame(detect);
      };
      detectLoopRef.current = requestAnimationFrame(detect);
    } catch (err: any) {
      console.error(err);
      setScannerError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access or use manual entry."
          : "Could not start the camera. Please try manual entry."
      );
      stopScanner();
    }
  };

  const closeScanner = () => {
    stopScanner();
    setScannerOpen(false);
  };

  const handleManualContinue = () => {
    const cleaned = manualVin.trim().toUpperCase();
    if (!isValidVin(cleaned)) {
      toast({
        title: "Invalid VIN",
        description:
          "VIN must be 17 characters, alphanumeric (no I, O, or Q).",
        variant: "destructive",
      });
      return;
    }
    handleVinCaptured(cleaned);
  };

  const resetAll = () => {
    setStage("capture");
    setVin("");
    setManualVin("");
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
            <ScanLine className="w-3.5 h-3.5" /> Scanning...
          </div>
        </div>

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
                Scan the VIN barcode on the driver-side door, or enter it manually
              </p>
            </div>

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
              {barcodeSupported ? (
                <Button
                  onClick={startScanner}
                  className="w-full h-16 text-base font-bold shadow-lg"
                  size="lg"
                >
                  <ScanLine className="w-6 h-6 mr-2" />
                  Scan VIN Barcode
                </Button>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Your browser doesn't support barcode scanning. Please enter
                    the VIN manually below.
                  </span>
                </div>
              )}
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
                    Type the 17-character VIN
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="manualVin" className="text-sm font-semibold mb-2 block">
                    VIN
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
                    }}
                    placeholder="17-character VIN"
                    maxLength={17}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    className="h-14 text-lg font-mono tracking-wider"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {manualVin.length}/17 · No I, O, or Q
                  </p>
                </div>
                <Button
                  onClick={handleManualContinue}
                  disabled={manualVin.length !== 17}
                  className="w-full h-14 text-base font-bold"
                  size="lg"
                >
                  Continue
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
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
                  <Button
                    onClick={() => navigate("/admin")}
                    variant="outline"
                    className="w-full h-14 text-base font-semibold"
                    size="lg"
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
