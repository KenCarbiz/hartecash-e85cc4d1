/**
 * OBD-II Diagnostic Trouble Code (DTC) reference library.
 *
 * Provides a lookup database of common trouble codes with
 * human-readable descriptions, affected vehicle systems, and
 * a severity rating used to prioritize inspection findings and
 * pricing adjustments on submissions.
 *
 * Code prefix guide:
 *   P0xxx - Powertrain, generic (SAE)
 *   P1xxx - Powertrain, manufacturer-specific
 *   P2xxx - Powertrain, generic (additional)
 *   B0xxx - Body
 *   C0xxx - Chassis
 *   U0xxx - Network / communication
 */

export type DtcSeverity = "low" | "medium" | "high";

export interface DtcEntry {
  description: string;
  system: string;
  severity: DtcSeverity;
}

export const DTC_DATABASE: Record<string, DtcEntry> = {
  // --- Fuel & Air Metering (P01xx) ---
  P0100: { description: "Mass or Volume Air Flow Circuit Malfunction", system: "Fuel & Air Metering", severity: "medium" },
  P0101: { description: "Mass or Volume Air Flow Circuit Range/Performance", system: "Fuel & Air Metering", severity: "medium" },
  P0102: { description: "Mass or Volume Air Flow Circuit Low Input", system: "Fuel & Air Metering", severity: "medium" },
  P0103: { description: "Mass or Volume Air Flow Circuit High Input", system: "Fuel & Air Metering", severity: "medium" },
  P0113: { description: "Intake Air Temperature Circuit High Input", system: "Fuel & Air Metering", severity: "low" },
  P0118: { description: "Engine Coolant Temperature Circuit High Input", system: "Engine Cooling", severity: "medium" },
  P0121: { description: "Throttle Position Sensor Circuit Range/Performance", system: "Fuel & Air Metering", severity: "medium" },
  P0128: { description: "Coolant Thermostat Below Regulating Temperature", system: "Engine Cooling", severity: "low" },
  P0131: { description: "O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)", system: "Emissions", severity: "medium" },
  P0132: { description: "O2 Sensor Circuit High Voltage (Bank 1 Sensor 1)", system: "Emissions", severity: "medium" },
  P0133: { description: "O2 Sensor Circuit Slow Response (Bank 1 Sensor 1)", system: "Emissions", severity: "medium" },
  P0134: { description: "O2 Sensor Circuit No Activity Detected (Bank 1 Sensor 1)", system: "Emissions", severity: "medium" },
  P0135: { description: "O2 Sensor Heater Circuit Malfunction (Bank 1 Sensor 1)", system: "Emissions", severity: "medium" },
  P0141: { description: "O2 Sensor Heater Circuit Malfunction (Bank 1 Sensor 2)", system: "Emissions", severity: "low" },
  P0171: { description: "System Too Lean (Bank 1)", system: "Fuel & Air Metering", severity: "medium" },
  P0172: { description: "System Too Rich (Bank 1)", system: "Fuel & Air Metering", severity: "medium" },
  P0174: { description: "System Too Lean (Bank 2)", system: "Fuel & Air Metering", severity: "medium" },
  P0175: { description: "System Too Rich (Bank 2)", system: "Fuel & Air Metering", severity: "medium" },

  // --- Ignition / Misfire (P03xx) ---
  P0300: { description: "Random/Multiple Cylinder Misfire Detected", system: "Ignition", severity: "high" },
  P0301: { description: "Cylinder 1 Misfire Detected", system: "Ignition", severity: "high" },
  P0302: { description: "Cylinder 2 Misfire Detected", system: "Ignition", severity: "high" },
  P0303: { description: "Cylinder 3 Misfire Detected", system: "Ignition", severity: "high" },
  P0304: { description: "Cylinder 4 Misfire Detected", system: "Ignition", severity: "high" },
  P0305: { description: "Cylinder 5 Misfire Detected", system: "Ignition", severity: "high" },
  P0306: { description: "Cylinder 6 Misfire Detected", system: "Ignition", severity: "high" },
  P0307: { description: "Cylinder 7 Misfire Detected", system: "Ignition", severity: "high" },
  P0308: { description: "Cylinder 8 Misfire Detected", system: "Ignition", severity: "high" },

  // --- Emissions / Auxiliary (P04xx) ---
  P0401: { description: "Exhaust Gas Recirculation Flow Insufficient Detected", system: "Emissions", severity: "medium" },
  P0403: { description: "Exhaust Gas Recirculation Control Circuit Malfunction", system: "Emissions", severity: "medium" },
  P0411: { description: "Secondary Air Injection System Incorrect Flow Detected", system: "Emissions", severity: "medium" },
  P0420: { description: "Catalyst System Efficiency Below Threshold (Bank 1)", system: "Emissions", severity: "high" },
  P0430: { description: "Catalyst System Efficiency Below Threshold (Bank 2)", system: "Emissions", severity: "high" },
  P0440: { description: "Evaporative Emission Control System Malfunction", system: "Emissions", severity: "medium" },
  P0441: { description: "Evaporative Emission Control System Incorrect Purge Flow", system: "Emissions", severity: "medium" },
  P0442: { description: "Evaporative Emission Control System Leak Detected (small leak)", system: "Emissions", severity: "low" },
  P0446: { description: "Evaporative Emission Control System Vent Control Circuit Malfunction", system: "Emissions", severity: "low" },
  P0455: { description: "Evaporative Emission Control System Leak Detected (gross leak)", system: "Emissions", severity: "medium" },
  P0456: { description: "Evaporative Emission Control System Leak Detected (very small leak)", system: "Emissions", severity: "low" },

  // --- Vehicle Speed / Idle / Aux Inputs (P05xx) ---
  P0500: { description: "Vehicle Speed Sensor Malfunction", system: "Transmission", severity: "medium" },
  P0505: { description: "Idle Control System Malfunction", system: "Engine Control", severity: "medium" },
  P0506: { description: "Idle Control System RPM Lower Than Expected", system: "Engine Control", severity: "low" },
  P0507: { description: "Idle Control System RPM Higher Than Expected", system: "Engine Control", severity: "medium" },

  // --- Computer & Auxiliary Outputs (P06xx) ---
  P0606: { description: "ECM/PCM Processor Fault", system: "Engine Control", severity: "high" },

  // --- Transmission (P07xx) ---
  P0700: { description: "Transmission Control System Malfunction", system: "Transmission", severity: "high" },
  P0715: { description: "Input/Turbine Speed Sensor Circuit Malfunction", system: "Transmission", severity: "medium" },
  P0720: { description: "Output Speed Sensor Circuit Malfunction", system: "Transmission", severity: "medium" },
  P0741: { description: "Torque Converter Clutch Circuit Performance / Stuck Off", system: "Transmission", severity: "high" },
  P0750: { description: "Shift Solenoid A Malfunction", system: "Transmission", severity: "high" },
  P0755: { description: "Shift Solenoid B Malfunction", system: "Transmission", severity: "high" },

  // --- Manufacturer Specific (P1xxx) ---
  P1000: { description: "OBD-II Monitor Testing Not Complete", system: "Diagnostics", severity: "low" },
  P1135: { description: "Air-Fuel Sensor Heater Circuit Response (Bank 1 Sensor 1)", system: "Emissions", severity: "medium" },
  P1399: { description: "Random Cylinder Misfire Detected (manufacturer)", system: "Ignition", severity: "high" },

  // --- Generic Additional (P2xxx) ---
  P2096: { description: "Post Catalyst Fuel Trim System Too Lean (Bank 1)", system: "Emissions", severity: "medium" },
  P2097: { description: "Post Catalyst Fuel Trim System Too Rich (Bank 1)", system: "Emissions", severity: "medium" },
  P2195: { description: "O2 Sensor Signal Stuck Lean (Bank 1 Sensor 1)", system: "Emissions", severity: "medium" },
  P2270: { description: "O2 Sensor Signal Stuck Lean (Bank 1 Sensor 2)", system: "Emissions", severity: "low" },

  // --- Network / Communication (U0xxx) ---
  U0100: { description: "Lost Communication With ECM/PCM", system: "Network", severity: "high" },
  U0101: { description: "Lost Communication With TCM", system: "Network", severity: "high" },
  U0121: { description: "Lost Communication With ABS Control Module", system: "Network", severity: "high" },
  U0140: { description: "Lost Communication With Body Control Module", system: "Network", severity: "medium" },
  U0155: { description: "Lost Communication With Instrument Panel Cluster", system: "Network", severity: "medium" },
};

const SEVERITY_SCORE: Record<DtcSeverity, number> = {
  low: 1,
  medium: 3,
  high: 7,
};

/**
 * Infer a reasonable fallback DTC entry for codes not present in the database.
 * Uses the code prefix to guess the system and severity.
 */
function inferFallback(code: string): DtcEntry {
  const upper = code.toUpperCase();
  const prefix = upper[0];

  let system = "Unknown";
  let severity: DtcSeverity = "medium";

  switch (prefix) {
    case "P":
      system = "Powertrain";
      // P03xx misfires are typically severe
      if (/^P03\d{2}$/.test(upper)) severity = "high";
      else if (/^P04[23]0$/.test(upper)) severity = "high";
      else severity = "medium";
      break;
    case "B":
      system = "Body";
      severity = "low";
      break;
    case "C":
      system = "Chassis";
      severity = "medium";
      break;
    case "U":
      system = "Network";
      severity = "high";
      break;
  }

  return {
    description: `Unknown trouble code ${upper}`,
    system,
    severity,
  };
}

/**
 * Look up a DTC code and return its description, affected system, and severity.
 * Falls back to a prefix-based inference when the code is not in the database.
 */
export function lookupDtc(code: string): DtcEntry {
  if (!code || typeof code !== "string") {
    return {
      description: "Invalid trouble code",
      system: "Unknown",
      severity: "low",
    };
  }
  const upper = code.trim().toUpperCase();
  const entry = DTC_DATABASE[upper];
  if (entry) return entry;
  return inferFallback(upper);
}

/**
 * Calculate an aggregate severity score for an array of DTC codes.
 * Returns the total severity (weighted sum) and the worst-severity code.
 */
export function calculateDtcSeverity(codes: string[]): {
  totalSeverity: number;
  worstCode: string | null;
} {
  if (!Array.isArray(codes) || codes.length === 0) {
    return { totalSeverity: 0, worstCode: null };
  }

  let totalSeverity = 0;
  let worstCode: string | null = null;
  let worstScore = -1;

  for (const raw of codes) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const code = raw.trim().toUpperCase();
    const entry = lookupDtc(code);
    const score = SEVERITY_SCORE[entry.severity] ?? 0;
    totalSeverity += score;
    if (score > worstScore) {
      worstScore = score;
      worstCode = code;
    }
  }

  return { totalSeverity, worstCode };
}
