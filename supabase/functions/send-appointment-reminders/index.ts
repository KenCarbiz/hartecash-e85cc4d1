import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-appointment-reminders — 24h + 2h dual-window reminder cadence.
 *
 * Scheduled every 15 minutes by pg_cron (see migration
 * 20260420180000). For each pending appointment with a scheduled_at,
 * checks whether the current time falls inside either reminder window
 * AND the corresponding sent-at column is null, then fires the
 * notification and stamps the sent_at column so we don't duplicate.
 *
 * Window semantics:
 *   24h reminder: fires when scheduled_at is 22.5h - 25.5h away
 *     (catches the cron slot that lands inside the target hour)
 *   2h reminder:  fires when scheduled_at is 1.5h  - 2.5h away
 *
 * The payload passed to send-notification includes reschedule_token so
 * the templated SMS/email can render a /reschedule/:token link.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Window = "24h" | "2h";

interface AppointmentRow {
  id: string;
  submission_id: string | null;
  submission_token: string | null;
  dealership_id: string | null;
  scheduled_at: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  store_location: string | null;
  location: string | null;
  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;
  reschedule_token: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pull every pending future appointment. Small table, cheap scan.
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        "id, submission_id, submission_token, dealership_id, scheduled_at, preferred_date, preferred_time, store_location, location, reminder_24h_sent_at, reminder_2h_sent_at, reschedule_token"
      )
      .eq("status", "pending");

    if (error) throw error;
    if (!appointments || appointments.length === 0) {
      return new Response(JSON.stringify({ sent_24h: 0, sent_2h: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch locations for display names (legacy store_location references)
    const { data: locations } = await supabase
      .from("dealership_locations")
      .select("id, name, city, state");
    const locMap = new Map(
      (locations || []).map((l: any) => [l.id, `${l.name} — ${l.city}, ${l.state}`])
    );

    const now = Date.now();
    let sent24h = 0;
    let sent2h = 0;

    for (const appt of appointments as AppointmentRow[]) {
      const scheduledAt = getScheduledAt(appt);
      if (!scheduledAt) continue;

      const hoursOut = (scheduledAt.getTime() - now) / (1000 * 60 * 60);

      const inside24hWindow = hoursOut >= 22.5 && hoursOut <= 25.5;
      const inside2hWindow = hoursOut >= 1.5 && hoursOut <= 2.5;

      if (inside24hWindow && !appt.reminder_24h_sent_at) {
        if (await fireReminder(supabase, appt, "24h", locMap)) {
          await supabase
            .from("appointments")
            .update({ reminder_24h_sent_at: new Date().toISOString() })
            .eq("id", appt.id);
          sent24h++;
        }
      }

      if (inside2hWindow && !appt.reminder_2h_sent_at) {
        if (await fireReminder(supabase, appt, "2h", locMap)) {
          await supabase
            .from("appointments")
            .update({ reminder_2h_sent_at: new Date().toISOString() })
            .eq("id", appt.id);
          sent2h++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent_24h: sent24h, sent_2h: sent2h }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-appointment-reminders error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getScheduledAt(appt: AppointmentRow): Date | null {
  if (appt.scheduled_at) return new Date(appt.scheduled_at);
  // Fall back to preferred_date + preferred_time if scheduled_at isn't
  // set. Parse as local dealership time — we don't have TZ per dealer
  // yet so assume server-local is close enough for reminder cadence.
  if (appt.preferred_date && appt.preferred_time) {
    const d = new Date(`${appt.preferred_date}T${normalizeTime(appt.preferred_time)}`);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function normalizeTime(t: string): string {
  // Handle "2:30 PM", "14:30", "2:30pm" etc. Cheap and good enough.
  const trimmed = t.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):?(\d{0,2})\s*(am|pm|AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const pm = ampmMatch[3].toLowerCase() === "pm";
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
  // Already 24h like "14:30"
  if (/^\d{1,2}:\d{2}/.test(trimmed)) return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  return "12:00:00";
}

async function fireReminder(
  supabase: any,
  appt: AppointmentRow,
  window: Window,
  locMap: Map<string, string>
): Promise<boolean> {
  // Resolve submission_id via either direct FK or token lookup.
  let submissionId = appt.submission_id;
  if (!submissionId && appt.submission_token) {
    const { data: sub } = await supabase
      .from("submissions")
      .select("id")
      .eq("token", appt.submission_token)
      .maybeSingle();
    submissionId = (sub as any)?.id ?? null;
  }
  if (!submissionId) return false;

  const locationLabel =
    appt.location ||
    locMap.get(appt.store_location || "") ||
    appt.store_location ||
    "";

  const triggerKey =
    window === "24h"
      ? "customer_appointment_reminder_24h"
      : "customer_appointment_reminder_2h";

  const { error } = await supabase.functions.invoke("send-notification", {
    body: {
      trigger_key: triggerKey,
      submission_id: submissionId,
      appointment_date: appt.preferred_date,
      appointment_time: appt.preferred_time,
      location: locationLabel,
      reschedule_token: appt.reschedule_token,
      reschedule_url: appt.reschedule_token
        ? `${Deno.env.get("PUBLIC_APP_URL") || ""}/reschedule/${appt.reschedule_token}`
        : null,
      window,
    },
  });
  if (error) {
    console.error(`send-appointment-reminders: notify failed for ${appt.id}`, error);
    return false;
  }
  return true;
}
