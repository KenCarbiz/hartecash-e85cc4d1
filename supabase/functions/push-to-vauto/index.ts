// push-to-vauto
// ----------------------------------------------------------------------------
// Cox Automotive / vAuto inventory push integration (skeleton).
//
// Today: operates in "staging" mode. When the dealer's credentials are missing
// OR the environment is "sandbox", the payload is logged to vauto_push_log with
// status "pending" and NO real API call is made. This lets the UI, audit trail,
// and auto-push plumbing run end-to-end with zero external dependencies.
//
// When real Cox API credentials become available, set environment to
// "production" on dealer_accounts — the same code path will POST to
// https://api.vauto.com/v1/vehicles, persist the returned vehicle id, and flip
// the submission flags.
// ----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Placeholder — replace with the real Cox Automotive endpoint when credentials
// are issued. Kept as a constant so swapping sandbox/prod later is a one-liner.
const VAUTO_API_URL = "https://api.vauto.com/v1/vehicles";

interface VautoPayload {
  source: string;
  dealer_id: string | null;
  vehicle: {
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    mileage: number | null;
    exterior_color: string | null;
    condition_grade: string | null;
  };
  valuation: {
    acv: number | null;
    currency: "USD";
  };
  customer: {
    name: string | null;
  };
  photos: string[];
  notes: string | null;
  meta: {
    hartecash_submission_id: string;
    pushed_at: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { submission_id, pushed_by, retry_log_id } = body ?? {};

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: submission_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Fetch the submission ──────────────────────────────────────
    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .maybeSingle();

    if (subErr || !submission) {
      return new Response(
        JSON.stringify({ error: "Submission not found", detail: subErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sub = submission as any;

    // ── 2. Fetch dealer's vAuto credentials ──────────────────────────
    // Single-tenant deployments key dealer_accounts on dealership_id='default'.
    // Multi-tenant deployments should join on the submission's store/dealer id
    // — hook that up here when ready.
    const dealershipId = sub.dealership_id || "default";
    const { data: dealerRaw } = await supabase
      .from("dealer_accounts")
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    const dealer = (dealerRaw ?? {}) as any;

    if (!dealer?.vauto_enabled) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "vAuto integration is not enabled for this dealer." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Collect photo URLs from customer-documents storage ────────
    const photoUrls: string[] = [];
    try {
      const folders = ["vehicle_photos", "exterior", "interior", "damage", "appraisal"];
      for (const folder of folders) {
        const { data: files } = await supabase.storage
          .from("customer-documents")
          .list(`${sub.token}/${folder}`);
        if (!files) continue;
        for (const f of files) {
          const { data: signed } = await supabase.storage
            .from("customer-documents")
            .createSignedUrl(`${sub.token}/${folder}/${f.name}`, 60 * 60 * 24);
          if (signed?.signedUrl) photoUrls.push(signed.signedUrl);
        }
      }
    } catch (photoErr) {
      console.warn("push-to-vauto: failed to collect photos", photoErr);
    }

    // ── 4. Build the vAuto payload ───────────────────────────────────
    const payload: VautoPayload = {
      source: sub.name || "HarteCash",
      dealer_id: dealer.vauto_dealer_id || null,
      vehicle: {
        vin: sub.vin || null,
        year: sub.year ?? null,
        make: sub.make || null,
        model: sub.model || null,
        trim: sub.trim || null,
        mileage: sub.mileage ?? null,
        exterior_color: sub.exterior_color || sub.color || null,
        condition_grade: sub.inspector_grade || sub.condition || null,
      },
      valuation: {
        acv: sub.acv_value ?? null,
        currency: "USD",
      },
      customer: {
        name: sub.name || null,
      },
      photos: photoUrls,
      notes: sub.appraisal_notes || sub.internal_notes || null,
      meta: {
        hartecash_submission_id: sub.id,
        pushed_at: new Date().toISOString(),
      },
    };

    const isSandbox = (dealer.vauto_api_environment || "sandbox") === "sandbox";
    const hasCredentials = Boolean(dealer.vauto_api_key) && Boolean(dealer.vauto_dealer_id);

    // ── 5a. Skeleton mode — log pending and return ───────────────────
    if (!hasCredentials || isSandbox) {
      const { data: logRow } = await supabase
        .from("vauto_push_log")
        .insert({
          submission_id: sub.id,
          pushed_by: pushed_by || "system",
          push_status: "pending",
          request_payload: payload as any,
          response_payload: null,
          error_message: !hasCredentials
            ? "Skeleton mode: credentials not configured"
            : "Sandbox mode: payload staged but not transmitted",
          retry_count: 0,
        } as any)
        .select()
        .maybeSingle();

      return new Response(
        JSON.stringify({
          status: "pending",
          mode: "skeleton",
          reason: !hasCredentials ? "credentials_missing" : "sandbox_environment",
          log_id: (logRow as any)?.id ?? null,
          payload,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5b. Real push path — Cox Automotive vAuto API ────────────────
    let pushStatus: "success" | "failed" = "failed";
    let responseJson: unknown = null;
    let errorMessage: string | null = null;
    let vautoVehicleId: string | null = null;

    try {
      const resp = await fetch(VAUTO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${dealer.vauto_api_key}`,
          "X-Dealer-Id": dealer.vauto_dealer_id,
        },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      try {
        responseJson = text ? JSON.parse(text) : null;
      } catch {
        responseJson = { raw: text };
      }

      if (resp.ok) {
        pushStatus = "success";
        const r = responseJson as any;
        vautoVehicleId = r?.vehicle_id || r?.id || r?.vautoVehicleId || null;
      } else {
        errorMessage = `vAuto API returned ${resp.status}: ${text.slice(0, 500)}`;
      }
    } catch (fetchErr) {
      errorMessage = `vAuto API fetch failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`;
    }

    // ── 6. Persist the audit log entry ───────────────────────────────
    let retryCount = 0;
    if (retry_log_id) {
      const { data: prevLog } = await supabase
        .from("vauto_push_log")
        .select("retry_count")
        .eq("id", retry_log_id)
        .maybeSingle();
      retryCount = ((prevLog as any)?.retry_count ?? 0) + 1;
    }

    const { data: logRow } = await supabase
      .from("vauto_push_log")
      .insert({
        submission_id: sub.id,
        pushed_by: pushed_by || "system",
        push_status: pushStatus,
        vauto_vehicle_id: vautoVehicleId,
        request_payload: payload as any,
        response_payload: responseJson as any,
        error_message: errorMessage,
        retry_count: retryCount,
      } as any)
      .select()
      .maybeSingle();

    // ── 7. On success, mark the submission ───────────────────────────
    if (pushStatus === "success") {
      await supabase
        .from("submissions")
        .update({
          vauto_pushed: true,
          vauto_pushed_at: new Date().toISOString(),
          vauto_vehicle_id: vautoVehicleId,
        } as any)
        .eq("id", sub.id);
    }

    return new Response(
      JSON.stringify({
        status: pushStatus,
        vauto_vehicle_id: vautoVehicleId,
        log_id: (logRow as any)?.id ?? null,
        error: errorMessage,
      }),
      {
        status: pushStatus === "success" ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("push-to-vauto error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
