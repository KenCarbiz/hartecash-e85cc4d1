import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Constant-time compare to avoid timing-based secret discovery.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Normalize a free-text time value like "10am", "10:00 AM",
 * "10:30", "2 PM" into a canonical "HH:MM AM/PM" form that both the
 * appointments table (stores as TEXT) and the customer-facing
 * confirmation email can display consistently.
 */
function normalizeTime(input: string): string | null {
  if (!input) return null;
  const raw = input.trim().toUpperCase().replace(/\s+/g, " ");

  // Match patterns like "10", "10 AM", "10:30", "10:30 AM", "2PM".
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3];

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  // If no AM/PM marker, assume business hours (9-18): <= 6 → PM, else AM.
  let suffix = period;
  if (!suffix) {
    if (hour === 0) {
      suffix = "AM";
      hour = 12;
    } else if (hour === 12) {
      suffix = "PM";
    } else if (hour > 12) {
      suffix = "PM";
      hour -= 12;
    } else if (hour <= 6) {
      suffix = "PM";
    } else {
      suffix = "AM";
    }
  } else {
    if (hour === 0) hour = 12;
    if (hour > 12) hour -= 12;
  }

  const mm = minute.toString().padStart(2, "0");
  return `${hour}:${mm} ${suffix}`;
}

/**
 * Normalize a date value from Bland. Accepts ISO (YYYY-MM-DD) directly,
 * or natural language like "Tuesday the 22nd" / "April 22, 2026" via
 * Date.parse as a fallback. Always returns YYYY-MM-DD or null.
 */
function normalizeDate(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Fast path: already ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : trimmed;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Fuzzy-match a free-text location name against dealership_locations.
 * Returns the matched row or null. Comparison is case-insensitive and
 * tolerates partial names (e.g. "Nissan Hartford" → "Harte Nissan").
 */
async function resolveLocation(
  supabase: ReturnType<typeof createClient>,
  rawName: string
): Promise<{ id: string; name: string; city: string; state: string } | null> {
  if (!rawName) return null;
  const needle = rawName.trim().toLowerCase();

  const { data: rows } = await supabase
    .from("dealership_locations")
    .select("id, name, city, state, is_active")
    .eq("is_active", true);

  if (!rows || rows.length === 0) return null;

  // 1. Exact match on name.
  const exact = rows.find(
    (r: any) => r.name?.toLowerCase() === needle
  );
  if (exact) return exact as any;

  // 2. Substring match — either direction.
  const partial = rows.find((r: any) => {
    const n = (r.name || "").toLowerCase();
    return n.includes(needle) || needle.includes(n);
  });
  if (partial) return partial as any;

  // 3. Token overlap (customer says "the Nissan store in Hartford").
  const needleTokens = needle.split(/\s+/).filter((t) => t.length > 2);
  const scored = rows.map((r: any) => {
    const hay = `${r.name || ""} ${r.city || ""}`.toLowerCase();
    const hits = needleTokens.filter((t) => hay.includes(t)).length;
    return { row: r, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);
  if (scored[0]?.hits >= 1) return scored[0].row;

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // ── Webhook authentication ──
    // Bland.ai does not sign tool-call requests, so we rely on a shared
    // secret. Accept the secret via either:
    //   - Authorization: Bearer <secret>
    //   - x-webhook-secret: <secret>
    //   - ?secret=<secret> query param
    // Fail closed if the server secret is not configured at all.
    const expectedSecret = Deno.env.get("BLAND_WEBHOOK_SECRET");
    if (!expectedSecret) {
      console.error(
        "book-appointment: BLAND_WEBHOOK_SECRET not configured — rejecting"
      );
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const authHeader = req.headers.get("authorization") || "";
    const bearerSecret = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const providedSecret =
      req.headers.get("x-webhook-secret") ||
      bearerSecret ||
      url.searchParams.get("secret") ||
      "";

    if (!timingSafeEqual(providedSecret, expectedSecret)) {
      console.warn("book-appointment: invalid or missing secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Extract fields (be permissive about naming from Bland's tool UI) ──
    const submissionId =
      payload.submission_id || payload.submissionId || null;
    const submissionToken =
      payload.submission_token || payload.token || null;
    const customerPhone =
      payload.customer_phone || payload.phone || null;

    const rawDate = payload.appointment_date || payload.date || "";
    const rawTime = payload.appointment_time || payload.time || "";
    const rawLocation =
      payload.location_name || payload.location || "";

    const customerName = payload.customer_name || payload.name || null;
    const customerEmail = payload.customer_email || payload.email || null;
    const vehicleInfo = payload.vehicle_info || null;
    const rawNotes = payload.notes || "";
    const visitReason =
      payload.reason || payload.visit_reason || "initial_appointment";
    const callLogId = payload.call_log_id || null;

    // ── Validate required fields ──
    const missing: string[] = [];
    if (!submissionId && !submissionToken && !customerPhone) {
      missing.push("submission_id OR submission_token OR customer_phone");
    }
    if (!rawDate) missing.push("appointment_date");
    if (!rawTime) missing.push("appointment_time");
    if (!rawLocation) missing.push("location_name");

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          missing,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const appointmentDate = normalizeDate(rawDate);
    const appointmentTime = normalizeTime(rawTime);

    if (!appointmentDate) {
      return new Response(
        JSON.stringify({
          error: "Could not parse appointment_date",
          value: rawDate,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (!appointmentTime) {
      return new Response(
        JSON.stringify({
          error: "Could not parse appointment_time",
          value: rawTime,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Reject past dates outright.
    const todayISO = new Date().toISOString().slice(0, 10);
    if (appointmentDate < todayISO) {
      return new Response(
        JSON.stringify({
          error: "Appointment date is in the past",
          appointment_date: appointmentDate,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Lookup submission ──
    let submissionQuery = supabase
      .from("submissions")
      .select(
        "id, token, name, email, phone, vehicle_year, vehicle_make, vehicle_model, offered_price, dealership_id, progress_status"
      );

    if (submissionId) {
      submissionQuery = submissionQuery.eq("id", submissionId);
    } else if (submissionToken) {
      submissionQuery = submissionQuery.eq("token", submissionToken);
    } else if (customerPhone) {
      // Fall back to most-recent submission for this phone number so Riley
      // can book without having to quote a UUID.
      submissionQuery = submissionQuery
        .eq("phone", customerPhone)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    const { data: submissions, error: subErr } = await submissionQuery;

    if (subErr) {
      console.error("book-appointment: submission lookup error", subErr);
      return new Response(
        JSON.stringify({ error: "Failed to look up submission" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const submission = submissions && submissions[0] ? submissions[0] : null;
    // Tenant isolation. Anonymous customers booking from the form / Riley
    // are allowed (UUID/token = capability). Authenticated staff must match.
    if (submission) {
      const caller = await resolveCaller(
        req,
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        supabaseKey,
      );
      if (caller.kind === "tenant_staff" && caller.dealershipId !== submission.dealership_id) {
        return forbidden(corsHeaders);
      }
    }
    if (!submission) {
      return new Response(
        JSON.stringify({
          error: "No matching submission found",
          hint: "Provide submission_id, submission_token, or the phone number that was originally used to request the offer.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Resolve location against dealership_locations ──
    const location = await resolveLocation(supabase, rawLocation);
    const locationDisplay = location
      ? `${location.name}${location.city ? `, ${location.city}` : ""}${location.state ? `, ${location.state}` : ""}`
      : rawLocation;

    // ── Idempotency: if an appointment already exists for this
    //    submission at this date+time, return the existing one instead
    //    of creating a duplicate. Bland's tool-call may retry on
    //    network hiccup and we don't want ghost bookings.
    const { data: existing } = await supabase
      .from("appointments")
      .select("id, preferred_date, preferred_time, status, created_at")
      .eq("submission_token", submission.token)
      .eq("preferred_date", appointmentDate)
      .eq("preferred_time", appointmentTime)
      .limit(1);

    if (existing && existing[0]) {
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          confirmation_number: existing[0].id.slice(0, 8).toUpperCase(),
          appointment_id: existing[0].id,
          submission_id: submission.id,
          message: `You're already confirmed for ${appointmentDate} at ${appointmentTime} at ${locationDisplay}. A reminder will come by text and email.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Build notes with visit reason context (useful for the sales team) ──
    const reasonLabels: Record<string, string> = {
      initial_appointment: "Customer accepted online offer — coming in to finalize.",
      finalize_deal: "Deal firmed up on Riley call — coming in to finalize & get paid.",
      inspection_to_firm_offer: "Needs in-person inspection to firm up the offer before sale.",
      reappraisal: "In-person reappraisal — condition review.",
    };
    const reasonNote = reasonLabels[visitReason] || reasonLabels.initial_appointment;

    const noteLines = [
      `Booked via Riley (Bland.ai voice AI).`,
      reasonNote,
      rawLocation && location && rawLocation.toLowerCase() !== location.name.toLowerCase()
        ? `Customer said: "${rawLocation}" — resolved to ${location.name}.`
        : null,
      rawNotes ? `Customer notes: ${rawNotes}` : null,
      callLogId ? `Source call: voice_call_log/${callLogId}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const resolvedVehicleInfo =
      vehicleInfo ||
      [
        submission.vehicle_year,
        submission.vehicle_make,
        submission.vehicle_model,
      ]
        .filter(Boolean)
        .join(" ");

    // ── Insert the appointment ──
    const { data: inserted, error: insertErr } = await supabase
      .from("appointments")
      .insert({
        submission_token: submission.token,
        customer_name: customerName || submission.name || "",
        customer_email: customerEmail || submission.email || "",
        customer_phone: customerPhone || submission.phone || "",
        preferred_date: appointmentDate,
        preferred_time: appointmentTime,
        vehicle_info: resolvedVehicleInfo || null,
        notes: noteLines,
        status: "confirmed",
        dealership_id: submission.dealership_id || "default",
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      console.error("book-appointment: insert failed", insertErr);
      return new Response(
        JSON.stringify({
          error: "Failed to create appointment",
          details: insertErr?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const confirmationNumber = inserted.id.slice(0, 8).toUpperCase();

    // ── Update submission state: progress → appointment_scheduled ──
    const nextStepCopy =
      visitReason === "inspection_to_firm_offer"
        ? "In-person inspection scheduled — ACV to be firmed at the store"
        : visitReason === "finalize_deal"
        ? "Coming in to finalize deal and collect check"
        : "Appointment scheduled — customer coming in to inspect/finalize";

    await supabase
      .from("submissions")
      .update({
        progress_status: "appointment_scheduled",
        status_updated_by: "riley_voice_ai",
        status_updated_at: new Date().toISOString(),
        next_step: nextStepCopy,
      })
      .eq("id", submission.id);

    // ── Activity log entry (audit trail on the customer file) ──
    await supabase.from("activity_log").insert({
      submission_id: submission.id,
      action: "appointment_scheduled_by_voice_ai",
      old_value: submission.progress_status || null,
      new_value: `${appointmentDate} ${appointmentTime} @ ${locationDisplay}`,
      performed_by: "Riley (Bland.ai)",
    });

    // ── Link the appointment back to the voice_call_log row, if any ──
    if (callLogId) {
      await supabase
        .from("voice_call_log")
        .update({
          outcome: "appointment_scheduled",
          metadata: {
            appointment_id: inserted.id,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            location: locationDisplay,
            confirmation_number: confirmationNumber,
          },
        })
        .eq("id", callLogId);
    }

    // ── Fire notifications (customer confirmation + staff alert) ──
    // We deliberately fire these in parallel and do not fail the
    // request if notifications are delayed — the appointment row
    // itself is the source of truth.
    Promise.allSettled([
      supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "customer_appointment_booked",
          submission_id: submission.id,
          context: {
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            location: locationDisplay,
            confirmation_number: confirmationNumber,
          },
        },
      }),
      supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "appointment_booked",
          submission_id: submission.id,
          context: {
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            location: locationDisplay,
            confirmation_number: confirmationNumber,
          },
        },
      }),
    ]).then((results) => {
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn(
            `book-appointment: notification ${i} failed`,
            r.reason
          );
        }
      });
    });

    // ── Speakable response Riley can read back on the call ──
    const spokenDate = new Date(`${appointmentDate}T12:00:00Z`).toLocaleDateString(
      "en-US",
      { weekday: "long", month: "long", day: "numeric" }
    );

    const speakable = `You're all set. I've got you confirmed for ${spokenDate} at ${appointmentTime} at ${locationDisplay}. Your confirmation number is ${confirmationNumber}. A text and email are on the way with what to bring. See you then!`;

    return new Response(
      JSON.stringify({
        success: true,
        idempotent: false,
        confirmation_number: confirmationNumber,
        appointment_id: inserted.id,
        submission_id: submission.id,
        appointment: {
          date: appointmentDate,
          time: appointmentTime,
          location: locationDisplay,
          location_id: location?.id || null,
          vehicle: resolvedVehicleInfo || null,
          reason: visitReason,
        },
        message: speakable,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("book-appointment: unhandled error", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
