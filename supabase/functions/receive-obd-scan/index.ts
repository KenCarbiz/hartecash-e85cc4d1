import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DtcCode {
  code: string;
  description?: string;
  severity?: "low" | "medium" | "high";
}

interface ObdScanPayload {
  submission_id?: string;
  submission_token?: string;
  token?: string;
  scanned_by?: string;
  scanner_device?: "web_bluetooth" | "mobile_app" | "manual" | string;
  vin_from_obd?: string;
  odometer_km?: number;
  odometer_miles?: number;
  dtc_codes?: DtcCode[];
  pending_dtc_codes?: DtcCode[];
  permanent_dtc_codes?: DtcCode[];
  mil_on?: boolean;
  readiness_monitors?: Record<string, string>;
  engine_coolant_temp?: number;
  fuel_system_status?: string;
  battery_voltage?: number;
  protocol?: string;
  ecu_name?: string;
  raw_data?: Record<string, unknown>;
}

const KM_TO_MILES = 0.621371;

function normalizeDtcArray(input: unknown): DtcCode[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (typeof item === "string") return { code: item };
      if (item && typeof item === "object" && typeof (item as DtcCode).code === "string") {
        const entry = item as DtcCode;
        return {
          code: entry.code,
          description: entry.description,
          severity: entry.severity,
        };
      }
      return null;
    })
    .filter((v): v is DtcCode => v !== null);
}

function countReadinessMonitors(monitors: Record<string, string> | undefined) {
  if (!monitors || typeof monitors !== "object") {
    return { ready: 0, notReady: 0 };
  }
  let ready = 0;
  let notReady = 0;
  for (const value of Object.values(monitors)) {
    const v = String(value).toLowerCase();
    if (v === "ready" || v === "complete" || v === "true") ready++;
    else if (v === "not_ready" || v === "incomplete" || v === "false") notReady++;
  }
  return { ready, notReady };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as ObdScanPayload;

    const submissionIdInput = payload.submission_id;
    const tokenInput = payload.submission_token || payload.token;

    if (!submissionIdInput && !tokenInput) {
      return new Response(
        JSON.stringify({ error: "Missing submission_id or submission_token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve submission by id or token
    let submissionId: string | null = submissionIdInput ?? null;
    let submissionRow: { id: string; token: string | null } | null = null;

    if (submissionIdInput) {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, token")
        .eq("id", submissionIdInput)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Submission not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      submissionRow = data as { id: string; token: string | null };
      submissionId = data.id;
    } else if (tokenInput) {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, token")
        .eq("token", tokenInput)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Invalid submission token" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      submissionRow = data as { id: string; token: string | null };
      submissionId = data.id;
    }

    if (!submissionId || !submissionRow) {
      return new Response(JSON.stringify({ error: "Could not resolve submission" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize DTCs
    const dtcCodes = normalizeDtcArray(payload.dtc_codes);
    const pendingDtcCodes = normalizeDtcArray(payload.pending_dtc_codes);
    const permanentDtcCodes = normalizeDtcArray(payload.permanent_dtc_codes);

    const dtcCount =
      dtcCodes.length + pendingDtcCodes.length + permanentDtcCodes.length;
    const hasActiveDtcs = dtcCodes.length > 0 || permanentDtcCodes.length > 0;
    const milOn = payload.mil_on === true;

    // Odometer conversion
    let odometerKm = typeof payload.odometer_km === "number" ? payload.odometer_km : null;
    let odometerMiles =
      typeof payload.odometer_miles === "number" ? payload.odometer_miles : null;
    if (odometerKm !== null && odometerMiles === null) {
      odometerMiles = Math.round(odometerKm * KM_TO_MILES * 10) / 10;
    } else if (odometerMiles !== null && odometerKm === null) {
      odometerKm = Math.round((odometerMiles / KM_TO_MILES) * 10) / 10;
    }

    // Readiness monitors counts
    const { ready: monitorsReady, notReady: monitorsNotReady } = countReadinessMonitors(
      payload.readiness_monitors,
    );

    // Insert scan
    const { data: scan, error: insertErr } = await supabase
      .from("vehicle_scans")
      .insert({
        submission_id: submissionId,
        scanned_by: payload.scanned_by ?? null,
        scanner_device: payload.scanner_device ?? null,
        vin_from_obd: payload.vin_from_obd ?? null,
        odometer_km: odometerKm,
        odometer_miles: odometerMiles,
        dtc_codes: dtcCodes,
        pending_dtc_codes: pendingDtcCodes,
        permanent_dtc_codes: permanentDtcCodes,
        mil_on: milOn,
        dtc_count: dtcCount,
        readiness_monitors: payload.readiness_monitors ?? {},
        monitors_ready_count: monitorsReady,
        monitors_not_ready_count: monitorsNotReady,
        engine_coolant_temp:
          typeof payload.engine_coolant_temp === "number"
            ? payload.engine_coolant_temp
            : null,
        fuel_system_status: payload.fuel_system_status ?? null,
        battery_voltage:
          typeof payload.battery_voltage === "number" ? payload.battery_voltage : null,
        protocol: payload.protocol ?? null,
        ecu_name: payload.ecu_name ?? null,
        raw_data: payload.raw_data ?? null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("vehicle_scans insert error:", insertErr);
      throw insertErr;
    }

    // Cross-check VIN to determine odometer verification status
    let odometerVerified: boolean | null = null;
    if (payload.vin_from_obd || odometerKm !== null) {
      const { data: subDetails } = await supabase
        .from("submissions")
        .select("vin, mileage")
        .eq("id", submissionId)
        .maybeSingle();

      if (subDetails) {
        // If we have a reported mileage (miles) and an OBD odometer, compare within 5%
        const reportedMiles =
          typeof (subDetails as { mileage?: number }).mileage === "number"
            ? (subDetails as { mileage?: number }).mileage!
            : null;
        if (reportedMiles !== null && odometerMiles !== null && reportedMiles > 0) {
          const diff = Math.abs(reportedMiles - odometerMiles) / reportedMiles;
          odometerVerified = diff <= 0.05;
        }
      }
    }

    // Update parent submission with quick-access flags
    const { error: updateErr } = await supabase
      .from("submissions")
      .update({
        obd_scan_completed: true,
        obd_has_active_dtcs: hasActiveDtcs,
        obd_mil_on: milOn,
        obd_odometer_verified: odometerVerified,
        latest_scan_id: scan.id,
      })
      .eq("id", submissionId);

    if (updateErr) {
      console.error("submissions update error:", updateErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scan,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("receive-obd-scan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
