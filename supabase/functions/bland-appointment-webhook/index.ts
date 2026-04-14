// Bland.AI appointment webhook
//
// Accepts POSTs from the Bland voice agent whenever a customer agrees
// on a date / time / location for an in-person visit. Three customer
// journeys land here (user direction, 2026-04-14):
//
//   1. Agreed to an offer on the site but never came in → Bland calls
//      to schedule the inspection.
//   2. Bland called cold, customer accepted the offer on the phone →
//      now needs to come in to finalize + get paid.
//   3. Offer is ballpark; we need to see the car to firm up the
//      number → inspection appointment drives the final offer.
//
// The Bland tool config should POST to this function with the payload
// shape documented in /docs/bland-appointment-webhook.md. Auth matches
// our existing voice-call-webhook: a shared secret in the
// `X-Webhook-Secret` header OR as a `?secret=` query param, compared
// with timing-safe equality. Same env var (`BLAND_WEBHOOK_SECRET`) so
// one credential covers both Bland integrations.
//
// Response contract: always 200 on successful authz (even for internal
// errors) to prevent Bland from retrying indefinitely. 401 on bad auth,
// 503 if the secret isn't configured.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

/** Constant-time string compare to avoid secret-length timing leaks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Strip to digits, drop leading "1" for 11-digit US numbers. Matches
 *  the app's existing `formatPhone` normalization semantics but collapses
 *  to a canonical 10-digit key so we can match submissions reliably. */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits || null;
}

/** Try to parse whatever Bland sends (ISO 8601, "2026-04-20 10:30 AM",
 *  epoch seconds, Date object). Returns a Date or null. */
function parseWhen(input: unknown): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") {
    const ms = input < 1e12 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === "string") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isoTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

interface BlandAppointmentPayload {
  // Required
  customer_name: string;
  customer_phone: string;
  // Either a combined scheduled_at OR preferred_date + preferred_time
  scheduled_at?: string;
  preferred_date?: string;
  preferred_time?: string;
  // Optional
  customer_email?: string;
  location?: string;
  notes?: string;
  vehicle_info?: string;
  appointment_type?: "inspection" | "finalization" | "firm_up_offer";
  status?: "pending" | "scheduled" | "confirmed";
  external_ref?: string;
  metadata?: {
    submission_id?: string;
    call_log_id?: string;
    dealership_id?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth ────────────────────────────────────────────────────────────
  const expectedSecret = Deno.env.get("BLAND_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("bland-appointment-webhook: BLAND_WEBHOOK_SECRET not configured");
    return json({ error: "Webhook not configured" }, 503);
  }
  const url = new URL(req.url);
  const providedSecret =
    req.headers.get("x-webhook-secret") || url.searchParams.get("secret") || "";
  if (!timingSafeEqual(providedSecret, expectedSecret)) {
    console.warn("bland-appointment-webhook: invalid or missing secret");
    return json({ error: "Unauthorized" }, 401);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Parse ───────────────────────────────────────────────────────────
  let body: BlandAppointmentPayload;
  try {
    body = (await req.json()) as BlandAppointmentPayload;
  } catch (e) {
    console.error("bland-appointment-webhook: invalid JSON", e);
    return json({ ok: false, error: "Invalid JSON" }, 200);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Required fields — name + phone + some notion of when.
    const customerName = (body.customer_name ?? "").trim();
    const customerPhoneRaw = (body.customer_phone ?? "").trim();
    const phoneKey = normalizePhone(customerPhoneRaw);

    if (!customerName || !phoneKey) {
      console.warn("bland-appointment-webhook: missing name or phone", { body });
      return json({ ok: false, error: "customer_name and customer_phone required" }, 200);
    }

    const when =
      parseWhen(body.scheduled_at) ??
      parseWhen(
        body.preferred_date && body.preferred_time
          ? `${body.preferred_date} ${body.preferred_time}`
          : body.preferred_date,
      );

    const preferred_date = when ? isoDate(when) : body.preferred_date ?? null;
    const preferred_time = when
      ? isoTime(when)
      : body.preferred_time ?? null;
    const scheduled_at = when ? when.toISOString() : null;

    if (!preferred_date) {
      console.warn("bland-appointment-webhook: missing date/time");
      return json(
        { ok: false, error: "scheduled_at or preferred_date required" },
        200,
      );
    }

    const appointment_type = body.appointment_type ?? "inspection";
    const status = body.status ?? "scheduled";
    const external_ref = body.external_ref ?? body.metadata?.call_log_id ?? null;

    const metadata = body.metadata ?? {};
    const metaDealershipId = metadata.dealership_id ?? null;
    const metaSubmissionId = metadata.submission_id ?? null;
    const metaCallLogId = metadata.call_log_id ?? null;

    // ── Resolve dealership_id ──────────────────────────────────────────
    // Prefer metadata. Fall back via submission_id → call_log_id. If all
    // fail, we still save to the default bucket so no data is lost.
    let dealership_id: string = metaDealershipId ?? "default";

    // ── Resolve submission_id ──────────────────────────────────────────
    // 1. Metadata if provided.
    // 2. Lookup by normalized phone (scoped to dealership if known).
    let submission_id: string | null = metaSubmissionId;

    if (!submission_id && phoneKey) {
      const { data: matches } = await supabase
        .from("submissions")
        .select("id, dealership_id")
        .or(`phone.ilike.%${phoneKey.slice(-10)}%`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (matches && matches.length > 0) {
        // Prefer a match in the resolved dealership if we have one; otherwise
        // take the most recent.
        const scoped =
          matches.find((m) => m.dealership_id === dealership_id) ?? matches[0];
        submission_id = scoped.id;
        if (!metaDealershipId && scoped.dealership_id) {
          dealership_id = scoped.dealership_id;
        }
      }
    }

    // ── Resolve call_log_id ────────────────────────────────────────────
    let call_log_id: string | null = metaCallLogId;
    if (!call_log_id && external_ref) {
      const { data: calls } = await supabase
        .from("voice_call_log")
        .select("id, dealership_id, submission_id")
        .eq("provider_call_id", external_ref)
        .limit(1);
      if (calls && calls.length > 0) {
        call_log_id = calls[0].id;
        if (!submission_id && calls[0].submission_id) {
          submission_id = calls[0].submission_id;
        }
      }
    }

    // ── Upsert appointment (idempotent on external_ref) ────────────────
    const row = {
      submission_id,
      call_log_id,
      dealership_id,
      customer_name: customerName,
      customer_email: body.customer_email ?? null,
      customer_phone: customerPhoneRaw,
      preferred_date,
      preferred_time,
      scheduled_at,
      location: body.location ?? null,
      notes: body.notes ?? null,
      vehicle_info: body.vehicle_info ?? null,
      appointment_type,
      status,
      source: "bland_ai",
      external_ref,
    };

    let appointmentId: string | null = null;

    if (external_ref) {
      // Idempotent upsert on (dealership_id, external_ref).
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("dealership_id", dealership_id)
        .eq("external_ref", external_ref)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("appointments")
          .update(row)
          .eq("id", existing.id);
        if (error) throw error;
        appointmentId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("appointments")
          .insert(row)
          .select("id")
          .single();
        if (error) throw error;
        appointmentId = inserted.id;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("appointments")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      appointmentId = inserted.id;
    }

    // ── Side effects ───────────────────────────────────────────────────
    // Push the parent submission forward in the pipeline so the admin
    // queues reflect "appointment booked".
    if (submission_id) {
      await supabase
        .from("submissions")
        .update({ progress_status: "appointment_scheduled" })
        .eq("id", submission_id);
    }

    // Note the outcome on the related call log, if any.
    if (call_log_id) {
      await supabase
        .from("voice_call_log")
        .update({ outcome: "appointment_scheduled" })
        .eq("id", call_log_id);
    }

    console.log("bland-appointment-webhook: booked", {
      appointmentId,
      submission_id,
      call_log_id,
      dealership_id,
      scheduled_at,
    });

    return json({
      ok: true,
      appointment_id: appointmentId,
      submission_id,
      dealership_id,
    });
  } catch (err) {
    console.error("bland-appointment-webhook: handler error", err);
    // Swallow errors with 200 so Bland doesn't retry forever. The
    // console log gives us a trail to replay from.
    return json(
      { ok: false, error: (err as Error).message ?? "internal error" },
      200,
    );
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
