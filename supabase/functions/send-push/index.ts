import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

/**
 * send-push — deliver a PWA web-push notification to one or many
 * staff members. Consumed by:
 *   - Direct invocation from staff-trigger fire sites that want
 *     push-first delivery (F1c will wire a fallback chain in
 *     send-notification)
 *   - Future hybrid orchestrator that tries push → falls back to SMS
 *
 * Body shape:
 *   {
 *     user_ids: string[]                (auth.user ids to ping)
 *     title: string
 *     body: string
 *     url?: string                      (deep link opened on click)
 *     tag?: string                      (coalesce dup notifications)
 *     submission_id?: string            (payload passthrough)
 *     trigger_key?: string              (payload passthrough)
 *     require_interaction?: boolean     (sticky until dismissed)
 *   }
 *
 * Returns { sent, stale, failed } counts so the caller can decide
 * whether to fall back to SMS.
 *
 * ENV required on the function:
 *   PUSH_VAPID_PUBLIC_KEY
 *   PUSH_VAPID_PRIVATE_KEY
 *   PUSH_VAPID_SUBJECT  (e.g. "mailto:ops@autocurb.io")
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC = Deno.env.get("PUSH_VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE = Deno.env.get("PUSH_VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("PUSH_VAPID_SUBJECT") || "mailto:ops@autocurb.io";
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(
        JSON.stringify({ error: "Push not configured — set PUSH_VAPID_* env vars." }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const userIds: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, stale: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", userIds)
      .eq("is_active", true);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, stale: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url,
      tag: body.tag,
      submission_id: body.submission_id,
      trigger_key: body.trigger_key,
      require_interaction: !!body.require_interaction,
    });

    let sent = 0;
    let stale = 0;
    let failed = 0;
    const staleIds: string[] = [];

    for (const s of subs as any[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload
        );
        sent++;
      } catch (e: unknown) {
        // 410 Gone / 404 Not Found = subscription is dead, flag stale.
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          staleIds.push(s.id);
          stale++;
        } else {
          console.warn("send-push failure:", s.endpoint, e);
          failed++;
        }
      }
    }

    if (staleIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .in("id", staleIds);
    }

    return new Response(
      JSON.stringify({ sent, stale, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
