import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Car,
  Gauge,
  Thermometer,
  XCircle,
  ArrowLeft,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Web Bluetooth type shims                                                  */
/* -------------------------------------------------------------------------- */
// Minimal typings so the file compiles without relying on lib.dom Web BT types.
type BTDevice = {
  name?: string;
  id?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BTServer>;
    disconnect: () => void;
  };
  addEventListener: (evt: string, cb: () => void) => void;
};
type BTServer = {
  getPrimaryService: (uuid: string) => Promise<BTService>;
  getPrimaryServices: () => Promise<BTService[]>;
  connected: boolean;
};
type BTService = {
  uuid: string;
  getCharacteristics: () => Promise<BTCharacteristic[]>;
  getCharacteristic: (uuid: string) => Promise<BTCharacteristic>;
};
type BTCharacteristic = {
  uuid: string;
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
    notify?: boolean;
    indicate?: boolean;
    read?: boolean;
  };
  writeValue?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  startNotifications: () => Promise<BTCharacteristic>;
  addEventListener: (evt: string, cb: (e: Event) => void) => void;
  removeEventListener: (evt: string, cb: (e: Event) => void) => void;
  value?: DataView;
};

/* -------------------------------------------------------------------------- */
/*  ELM327Scanner                                                             */
/* -------------------------------------------------------------------------- */
/*
 * Basic Web Bluetooth ELM327 wrapper.
 *
 * NOTE: This is a *basic* implementation of the ELM327 AT command protocol.
 * Real-world BLE OBD adapters vary wildly:
 *   - OBDLink CX uses a proprietary service UUID
 *   - Generic ELM327 BLE clones commonly expose 0xFFF0 / 0xFFE0
 *   - Vgate iCar Pro uses 0x18F0
 * Characteristics for TX/RX are auto-detected by walking properties
 * (write vs. notify). Real refinement may be needed per adapter model.
 *
 * Response framing on ELM327 is line-based, terminated by '>' (the prompt).
 * We buffer notifications until we see the prompt, then resolve the command.
 */
class ELM327Scanner {
  private device: BTDevice | null = null;
  private server: BTServer | null = null;
  private service: BTService | null = null;
  private writeChar: BTCharacteristic | null = null;
  private notifyChar: BTCharacteristic | null = null;

  private buffer = "";
  private pending: {
    resolve: (v: string) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  // Common BLE OBD service UUIDs, tried in order.
  private static readonly SERVICE_UUIDS = [
    "0000fff0-0000-1000-8000-00805f9b34fb", // Generic ELM327 BLE
    "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / iCar
    "000018f0-0000-1000-8000-00805f9b34fb", // Vgate
    "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // OBDLink / common
  ];

  async connect(): Promise<void> {
    const nav = navigator as unknown as {
      bluetooth?: {
        requestDevice: (opts: unknown) => Promise<BTDevice>;
      };
    };
    if (!nav.bluetooth) {
      throw new Error("Web Bluetooth not supported in this browser.");
    }

    // Request any device that advertises any of the common OBD service UUIDs.
    // We also allow name prefix filters for common ELM327 clones.
    this.device = await nav.bluetooth.requestDevice({
      filters: [
        { services: ELM327Scanner.SERVICE_UUIDS },
        { namePrefix: "OBD" },
        { namePrefix: "OBDII" },
        { namePrefix: "ELM" },
        { namePrefix: "Vgate" },
        { namePrefix: "IOS-Vlink" },
        { namePrefix: "OBDLink" },
      ],
      optionalServices: ELM327Scanner.SERVICE_UUIDS,
    });

    if (!this.device?.gatt) throw new Error("Selected device has no GATT server.");

    this.device.addEventListener("gattserverdisconnected", () => {
      this.server = null;
      this.service = null;
      this.writeChar = null;
      this.notifyChar = null;
    });

    this.server = await this.device.gatt.connect();

    // Try each known service UUID until one resolves.
    for (const uuid of ELM327Scanner.SERVICE_UUIDS) {
      try {
        this.service = await this.server.getPrimaryService(uuid);
        if (this.service) break;
      } catch {
        /* try next */
      }
    }
    if (!this.service) {
      // Fallback: enumerate all primary services
      const all = await this.server.getPrimaryServices();
      if (all.length > 0) this.service = all[0];
    }
    if (!this.service) throw new Error("No compatible OBD service found on device.");

    const chars = await this.service.getCharacteristics();
    for (const c of chars) {
      if (!this.writeChar && (c.properties.write || c.properties.writeWithoutResponse)) {
        this.writeChar = c;
      }
      if (!this.notifyChar && (c.properties.notify || c.properties.indicate)) {
        this.notifyChar = c;
      }
    }
    if (!this.writeChar || !this.notifyChar) {
      throw new Error("Could not find read/write characteristics on OBD device.");
    }

    await this.notifyChar.startNotifications();
    this.notifyChar.addEventListener("characteristicvaluechanged", this.handleNotify);

    // Initialize the ELM327
    await this.sendCommand("ATZ"); // reset
    await this.sendCommand("ATE0"); // echo off
    await this.sendCommand("ATL0"); // linefeeds off
    await this.sendCommand("ATS0"); // spaces off
    await this.sendCommand("ATH0"); // headers off
    await this.sendCommand("ATSP0"); // auto protocol
  }

  private handleNotify = (e: Event) => {
    const target = e.target as unknown as BTCharacteristic;
    const dv = target.value;
    if (!dv) return;
    let chunk = "";
    for (let i = 0; i < dv.byteLength; i++) {
      chunk += String.fromCharCode(dv.getUint8(i));
    }
    this.buffer += chunk;

    // '>' is the ELM327 prompt that marks end-of-response.
    if (this.buffer.includes(">")) {
      const response = this.buffer.replace(/>/g, "").trim();
      this.buffer = "";
      if (this.pending) {
        clearTimeout(this.pending.timer);
        const { resolve } = this.pending;
        this.pending = null;
        resolve(response);
      }
    }
  };

  async sendCommand(cmd: string, timeoutMs = 4000): Promise<string> {
    if (!this.writeChar) throw new Error("Not connected.");

    // Wait for any prior pending command
    while (this.pending) {
      await new Promise((r) => setTimeout(r, 20));
    }

    const payload = new TextEncoder().encode(cmd + "\r");
    const writeFn =
      this.writeChar.writeValueWithoutResponse?.bind(this.writeChar) ||
      this.writeChar.writeValue?.bind(this.writeChar) ||
      this.writeChar.writeValueWithResponse?.bind(this.writeChar);
    if (!writeFn) throw new Error("Write characteristic has no write method.");

    return new Promise<string>((resolve, reject) => {
      this.pending = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.pending = null;
          reject(new Error(`Timeout waiting for response to "${cmd}"`));
        }, timeoutMs),
      };
      writeFn(payload).catch((err: Error) => {
        if (this.pending) {
          clearTimeout(this.pending.timer);
          this.pending = null;
        }
        reject(err);
      });
    });
  }

  /**
   * Mode 01 PID 01: monitor status since DTCs cleared.
   * Returns [milOn, dtcCount]
   */
  async readMilStatus(): Promise<{ milOn: boolean; dtcCount: number }> {
    const resp = await this.sendCommand("0101");
    // Expected response like: "41 01 XX XX XX XX"
    const hex = resp.replace(/\s+/g, "").toUpperCase();
    const idx = hex.indexOf("4101");
    if (idx === -1) return { milOn: false, dtcCount: 0 };
    const a = parseInt(hex.substring(idx + 4, idx + 6), 16);
    if (Number.isNaN(a)) return { milOn: false, dtcCount: 0 };
    return {
      milOn: (a & 0x80) !== 0,
      dtcCount: a & 0x7f,
    };
  }

  /**
   * Mode 01 PID 05: engine coolant temperature (A - 40) in Celsius.
   */
  async readCoolantTemp(): Promise<number | null> {
    try {
      const resp = await this.sendCommand("0105");
      const hex = resp.replace(/\s+/g, "").toUpperCase();
      const idx = hex.indexOf("4105");
      if (idx === -1) return null;
      const a = parseInt(hex.substring(idx + 4, idx + 6), 16);
      if (Number.isNaN(a)) return null;
      return a - 40;
    } catch {
      return null;
    }
  }

  /**
   * Mode 01 PID A6: odometer (if supported). Returns kilometers.
   * Formula per SAE J1979: ((A*2^24) + (B*2^16) + (C*2^8) + D) / 10
   */
  async readOdometer(): Promise<number | null> {
    try {
      const resp = await this.sendCommand("01A6");
      const hex = resp.replace(/\s+/g, "").toUpperCase();
      const idx = hex.indexOf("41A6");
      if (idx === -1) return null;
      const a = parseInt(hex.substring(idx + 4, idx + 6), 16);
      const b = parseInt(hex.substring(idx + 6, idx + 8), 16);
      const c = parseInt(hex.substring(idx + 8, idx + 10), 16);
      const d = parseInt(hex.substring(idx + 10, idx + 12), 16);
      if ([a, b, c, d].some(Number.isNaN)) return null;
      return (a * 0x1000000 + b * 0x10000 + c * 0x100 + d) / 10;
    } catch {
      return null;
    }
  }

  /**
   * Mode 03 / 07 / 0A: DTC lists. Returns decoded codes like ["P0301","P0420"].
   */
  async readDtcs(mode: "03" | "07" | "0A" = "03"): Promise<string[]> {
    const resp = await this.sendCommand(mode);
    return ELM327Scanner.parseDtcResponse(resp, mode);
  }

  static parseDtcResponse(resp: string, mode: string): string[] {
    // Response header byte: 43 for mode 03, 47 for mode 07, 4A for mode 0A.
    const header = (0x40 + parseInt(mode, 16)).toString(16).toUpperCase().padStart(2, "0");
    const clean = resp.replace(/[\r\n>]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    if (clean.includes("NO DATA") || clean.includes("UNABLE")) return [];

    // Collapse to hex pairs only, across possibly multi-frame response.
    const hex = clean.replace(/[^0-9A-F]/g, "");
    const codes: string[] = [];

    // Find each header occurrence and decode following bytes in pairs of 2 bytes.
    let i = hex.indexOf(header);
    while (i !== -1) {
      let j = i + 2;
      // Read pairs of 2 bytes (4 hex chars) = one DTC
      while (j + 4 <= hex.length) {
        const chunk = hex.substring(j, j + 4);
        // Stop if we've hit the next header segment
        if (chunk.substring(0, 2) === header && codes.length > 0) break;
        if (chunk === "0000") {
          j += 4;
          continue;
        }
        const code = ELM327Scanner.decodeDtc(chunk);
        if (code) codes.push(code);
        j += 4;
      }
      i = hex.indexOf(header, j);
    }
    // De-dupe
    return Array.from(new Set(codes));
  }

  /** Decode a 4-char hex chunk (2 bytes) into a P/C/B/U DTC. */
  static decodeDtc(hex4: string): string | null {
    if (hex4.length !== 4) return null;
    const first = parseInt(hex4.charAt(0), 16);
    if (Number.isNaN(first)) return null;
    const typeChar = ["P", "C", "B", "U"][(first & 0xc) >> 2];
    const firstDigit = (first & 0x3).toString();
    const rest = hex4.substring(1);
    return `${typeChar}${firstDigit}${rest}`;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.notifyChar) {
        this.notifyChar.removeEventListener("characteristicvaluechanged", this.handleNotify);
      }
    } catch {
      /* ignore */
    }
    try {
      if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    } catch {
      /* ignore */
    }
    this.device = null;
    this.server = null;
    this.service = null;
    this.writeChar = null;
    this.notifyChar = null;
  }
}

/* -------------------------------------------------------------------------- */
/*  OBDScan page                                                              */
/* -------------------------------------------------------------------------- */

interface ScanSubmission {
  id: string;
  token: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;
  name: string | null;
}

type Phase = "idle" | "connecting" | "scanning" | "uploading" | "done" | "error";

interface StepState {
  key: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

const SCAN_STEPS: Omit<StepState, "status">[] = [
  { key: "init", label: "Initializing ELM327" },
  { key: "mil", label: "Reading MIL status" },
  { key: "dtc", label: "Reading stored DTCs" },
  { key: "pending", label: "Reading pending DTCs" },
  { key: "permanent", label: "Reading permanent DTCs" },
  { key: "temp", label: "Reading coolant temp" },
  { key: "odo", label: "Reading odometer" },
];

const OBDScan = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ScanSubmission | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [connectionLabel, setConnectionLabel] = useState("Not connected");
  const [steps, setSteps] = useState<StepState[]>(
    SCAN_STEPS.map((s) => ({ ...s, status: "pending" as const }))
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    milOn: boolean;
    dtcCount: number;
    dtcs: string[];
    pendingDtcs: string[];
    permanentDtcs: string[];
    coolantTemp: number | null;
    odometer: number | null;
  } | null>(null);

  const scannerRef = useRef<ELM327Scanner | null>(null);
  const webBluetoothSupported =
    typeof navigator !== "undefined" && !!(navigator as unknown as { bluetooth?: unknown }).bluetooth;

  /* ------------------------------ Load sub ------------------------------ */
  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("Invalid scan link.");
        setLoading(false);
        return;
      }
      const { data, error: err } = await supabase.rpc("get_submission_portal", { _token: token });
      if (err || !data || (data as unknown[]).length === 0) {
        setError("Scan session not found. Please check your link.");
        setLoading(false);
        return;
      }
      const row = (data as unknown as ScanSubmission[])[0];
      setSubmission(row);
      setLoading(false);
    };
    load();
  }, [token]);

  /* ------------------------------ Helpers ------------------------------- */
  const updateStep = useCallback((key: string, status: StepState["status"]) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));
  }, []);

  /* ------------------------------ Scan flow ----------------------------- */
  const handleScan = async () => {
    if (!webBluetoothSupported) return;
    setScanError(null);
    setResult(null);
    setSteps(SCAN_STEPS.map((s) => ({ ...s, status: "pending" as const })));

    const scanner = new ELM327Scanner();
    scannerRef.current = scanner;

    try {
      setPhase("connecting");
      setConnectionLabel("Requesting device...");
      await scanner.connect();
      setConnectionLabel("Connected");

      setPhase("scanning");

      // Init already performed inside connect(); mark it done.
      updateStep("init", "done");

      updateStep("mil", "active");
      const mil = await scanner.readMilStatus();
      updateStep("mil", "done");

      updateStep("dtc", "active");
      const dtcs = await scanner.readDtcs("03");
      updateStep("dtc", "done");

      updateStep("pending", "active");
      let pendingDtcs: string[] = [];
      try {
        pendingDtcs = await scanner.readDtcs("07");
      } catch {
        /* some adapters/ECUs don't respond */
      }
      updateStep("pending", "done");

      updateStep("permanent", "active");
      let permanentDtcs: string[] = [];
      try {
        permanentDtcs = await scanner.readDtcs("0A");
      } catch {
        /* ignore */
      }
      updateStep("permanent", "done");

      updateStep("temp", "active");
      const coolantTemp = await scanner.readCoolantTemp();
      updateStep("temp", "done");

      updateStep("odo", "active");
      const odometer = await scanner.readOdometer();
      updateStep("odo", "done");

      const scanResult = {
        milOn: mil.milOn,
        dtcCount: mil.dtcCount,
        dtcs,
        pendingDtcs,
        permanentDtcs,
        coolantTemp,
        odometer,
      };
      setResult(scanResult);

      // Upload
      setPhase("uploading");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const body = {
        submission_token: token,
        scanned_by: "web_bluetooth_user",
        scanner_device: "web_bluetooth",
        dtc_codes: dtcs,
        pending_dtc_codes: pendingDtcs,
        mil_on: mil.milOn,
        engine_coolant_temp: coolantTemp,
        raw_data: {
          permanent_dtcs: permanentDtcs,
          dtc_count: mil.dtcCount,
          odometer_km: odometer,
          user_agent: navigator.userAgent,
          scanned_at: new Date().toISOString(),
        },
      };

      const res = await fetch(`${supabaseUrl}/functions/v1/receive-obd-scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Upload failed: ${res.status} ${txt}`);
      }

      setPhase("done");
      toast({
        title: "Scan uploaded",
        description: "Results sent successfully.",
      });

      // Disconnect cleanly
      try {
        await scanner.disconnect();
      } catch {
        /* ignore */
      }
      setConnectionLabel("Disconnected");

      // Redirect back after 3 seconds
      setTimeout(() => {
        navigate(`/my-submission/${token}`);
      }, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error during scan";
      setScanError(msg);
      setPhase("error");
      // Mark the first active step as error
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.status === "active");
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], status: "error" };
        return copy;
      });
      try {
        await scanner.disconnect();
      } catch {
        /* ignore */
      }
      setConnectionLabel("Disconnected");
    }
  };

  /* Clean up on unmount */
  useEffect(() => {
    return () => {
      scannerRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  /* ------------------------------ Render -------------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-sm text-center space-y-4">
          <XCircle className="w-12 h-12 mx-auto text-red-400" />
          <h1 className="text-xl font-semibold">Unable to load scan</h1>
          <p className="text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  const vehicleLabel = submission
    ? [submission.vehicle_year, submission.vehicle_make, submission.vehicle_model]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-md mx-auto px-5 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Bluetooth className="w-4 h-4" />
            OBD-II Scanner
          </div>
          <div className="w-9" />
        </div>

        {/* Vehicle card */}
        <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Car className="w-5 h-5 text-blue-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-400">Vehicle</p>
              <p className="font-semibold text-lg truncate">{vehicleLabel || "Unknown vehicle"}</p>
              {submission?.vin && (
                <p className="text-xs text-slate-400 font-mono truncate">VIN: {submission.vin}</p>
              )}
            </div>
          </div>
        </div>

        {/* Unsupported browser fallback */}
        {!webBluetoothSupported && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Browser not supported</p>
                <p className="text-sm text-amber-100/80 mt-1">
                  Web Bluetooth is not supported in this browser. Please use Android Chrome or Edge to
                  scan, or use the HarteCash Scanner mobile app.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection status */}
        {webBluetoothSupported && (
          <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 mb-6 flex items-center gap-3">
            {phase === "connecting" || phase === "uploading" ? (
              <Loader2 className="w-5 h-5 text-blue-300 animate-spin" />
            ) : phase === "scanning" || phase === "done" ? (
              <BluetoothConnected className="w-5 h-5 text-emerald-400" />
            ) : phase === "error" ? (
              <BluetoothOff className="w-5 h-5 text-red-400" />
            ) : (
              <Bluetooth className="w-5 h-5 text-slate-400" />
            )}
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
              <p className="font-medium">{connectionLabel}</p>
            </div>
          </div>
        )}

        {/* Big connect button */}
        {webBluetoothSupported && phase !== "done" && (
          <Button
            onClick={handleScan}
            disabled={phase === "connecting" || phase === "scanning" || phase === "uploading"}
            className="w-full h-16 text-base font-semibold rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-900/50"
          >
            {phase === "idle" || phase === "error" ? (
              <>
                <Bluetooth className="w-5 h-5 mr-2" />
                {phase === "error" ? "Try Again" : "Connect Scanner"}
              </>
            ) : phase === "connecting" ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Connecting...
              </>
            ) : phase === "uploading" ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Scanning...
              </>
            )}
          </Button>
        )}

        {/* Steps */}
        {webBluetoothSupported && (phase === "scanning" || phase === "uploading" || phase === "done" || phase === "error") && (
          <div className="mt-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-4">Scan Progress</p>
            <div className="space-y-3">
              {steps.map((s) => (
                <div key={s.key} className="flex items-center gap-3 text-sm">
                  {s.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : s.status === "active" ? (
                    <Loader2 className="w-4 h-4 text-blue-300 flex-shrink-0 animate-spin" />
                  ) : s.status === "error" ? (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-500 flex-shrink-0" />
                  )}
                  <span
                    className={
                      s.status === "done"
                        ? "text-slate-200"
                        : s.status === "active"
                          ? "text-white"
                          : s.status === "error"
                            ? "text-red-300"
                            : "text-slate-500"
                    }
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">Results</p>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  result.milOn
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                MIL {result.milOn ? "ON" : "OFF"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/30 border border-white/5 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Gauge className="w-3 h-3" />
                  DTC Count
                </div>
                <p className="text-2xl font-bold mt-1">{result.dtcCount}</p>
              </div>
              <div className="rounded-xl bg-black/30 border border-white/5 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Thermometer className="w-3 h-3" />
                  Coolant
                </div>
                <p className="text-2xl font-bold mt-1">
                  {result.coolantTemp !== null ? `${result.coolantTemp}°C` : "—"}
                </p>
              </div>
            </div>

            {result.dtcs.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Stored DTCs</p>
                <div className="flex flex-wrap gap-2">
                  {result.dtcs.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-1 rounded-md text-xs font-mono bg-red-500/15 text-red-300 border border-red-500/30"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.pendingDtcs.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Pending DTCs</p>
                <div className="flex flex-wrap gap-2">
                  {result.pendingDtcs.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-1 rounded-md text-xs font-mono bg-amber-500/15 text-amber-200 border border-amber-500/30"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.permanentDtcs.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-2">Permanent DTCs</p>
                <div className="flex flex-wrap gap-2">
                  {result.permanentDtcs.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-1 rounded-md text-xs font-mono bg-purple-500/15 text-purple-200 border border-purple-500/30"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.dtcs.length === 0 &&
              result.pendingDtcs.length === 0 &&
              result.permanentDtcs.length === 0 && (
                <p className="text-sm text-slate-300">No trouble codes found.</p>
              )}
          </div>
        )}

        {/* Error */}
        {scanError && (
          <div className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/30 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Scan failed</p>
                <p className="text-sm text-red-200/80 mt-1 break-words">{scanError}</p>
                <p className="text-xs text-red-200/60 mt-2">
                  Make sure the adapter is plugged in, the ignition is on, and your phone is paired.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success overlay */}
        {phase === "done" && (
          <div className="mt-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
            <p className="text-lg font-semibold text-emerald-200">Scan complete!</p>
            <p className="text-sm text-emerald-100/80 mt-1">
              Redirecting you back in a moment...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OBDScan;
