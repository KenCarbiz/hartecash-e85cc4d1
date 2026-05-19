// @jwt-required — admin/cron only; default verify_jwt=true is correct.
// launch-voice-call-openai
//
// Companion to launch-voice-call (which currently routes every call
// through bland.ai). When the dealer selects "openai" as their
// voice_ai_provider in Voice AI settings, launch-voice-call hands
// off to this function instead.
//
// What this function DOES today:
//   - Validates the submission + campaign
//   - Confirms the dealer is on the openai provider (vs bland)
//   - Verifies the dependencies are configured: OPENAI_API_KEY env
//     secret AND a Twilio account on the dealer record
//   - Returns a clear, structured error when those aren't ready,
//     telling the admin exactly which step they're missing
//
// What this function does NOT do yet:
//   - Place the actual phone call. OpenAI Realtime is a WebSocket
//     conversation API, not a telephony provider. Real outbound
//     dialing requires:
//       1. Twilio outbound call started via /Calls REST API
//       2. TwiML returned to Twilio that <Connect>s a media-stream
//          WebSocket back to a Supabase Edge Function
//       3. That function bridges Twilio Media Streams audio frames
//          to OpenAI Realtime WSS (and back), translating G.711 ↔
//          PCM as needed
//   - The bridge is non-trivial (~1 day of work + ongoing tuning)
//     and intentionally out of scope for the v1 selector. Schedule
//     it once the dealer's set up their Twilio account and we know
//     they actually want to use this provider in production.
//
// To complete the OpenAI integration:
//   1. Add Twilio creds columns to dealer_accounts:
//        twilio_account_sid, twilio_auth_token, twilio_from_number
//   2. Set OPENAI_API_KEY in Supabase Edge Function secrets
//   3. Build a sister function `voice-call-openai-bridge` that
//      handles WebSocket upgrades from Twilio Media Streams and
//      proxies audio to wss://api.openai.com/v1/realtime
//   4. Replace the "not yet operational" branch below with a real
//      Twilio /Calls POST that points at the bridge

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireProduct } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  submission_id?: string;
  campaign_id?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Tier gate: AI Voice agent requires the autocurb_premium tier.
  const gate = await requireProduct(req, "autocurb", {
    requiredTierIds: ["autocurb_premium"],
  });
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.reason, upgrade_required: true }), {
      status: gate.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RequestBody = await req.json().catch(() => ({}));
    const submissionId = body.submission_id;
    if (!submissionId) {
      return json({ error: "submission_id required" }, 400);
    }

    // Pull the submission's dealer + voice config to verify the
    // provider selection and check the prerequisites.
    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("id, dealership_id")
      .eq("id", submissionId)
      .maybeSingle();
    if (subErr || !submission) {
      return json({ error: "Submission not found" }, 404);
    }
    const { data: dealer } = await supabase
      .from("dealer_accounts")
      .select(
        "id, voice_ai_provider, voice_ai_enabled, " +
        // Twilio creds — added when the OpenAI provider is fully wired
        "twilio_account_sid, twilio_auth_token, twilio_from_number",
      )
      .eq("dealership_id", submission.dealership_id)
      .maybeSingle();
    if (!dealer) {
      return json({ error: "Dealer account not found" }, 404);
    }

    const provider = (dealer.voice_ai_provider || "bland").toLowerCase();
    if (provider !== "openai") {
      return json(
        {
          error: `Dealer voice_ai_provider is "${provider}", expected "openai". Use launch-voice-call directly.`,
        },
        400,
      );
    }

    // ── Prerequisite check ────────────────────────────────────────
    // Tell the admin EXACTLY what's missing so they can fix it
    // without bouncing between docs. This is the single most
    // useful thing for v1 — the selector exists in the UI and the
    // function tells you what to do next.
    const missing: string[] = [];
    if (!Deno.env.get("OPENAI_API_KEY")) {
      missing.push(
        "Set OPENAI_API_KEY in Supabase Edge Function secrets " +
        "(get a key at platform.openai.com).",
      );
    }
    if (!(dealer as Record<string, unknown>).twilio_account_sid) {
      missing.push(
        "Add Twilio Account SID to dealer voice settings.",
      );
    }
    if (!(dealer as Record<string, unknown>).twilio_auth_token) {
      missing.push(
        "Add Twilio Auth Token to dealer voice settings.",
      );
    }
    if (!(dealer as Record<string, unknown>).twilio_from_number) {
      missing.push(
        "Add a Twilio outbound phone number to dealer voice settings.",
      );
    }

    if (missing.length > 0) {
      return json({
        error: "openai_provider_not_yet_operational",
        provider: "openai",
        message:
          "OpenAI voice provider is selected but isn't fully configured yet. " +
          "Bland.ai is still the working option — switch back in Voice AI settings " +
          "if you need to make calls today.",
        missing_setup_steps: missing,
        next_step:
          "Once the items above are in place, the launch-voice-call-openai function " +
          "will need its Twilio + Realtime bridge enabled (see the file's top-of-file " +
          "comment for the four-step plan). Contact Autocurb engineering to ship that.",
      });
    }

    // ── Real launch path (placeholder) ────────────────────────────
    // All prereqs are present. The Twilio /Calls POST + media-stream
    // bridge isn't shipped in this PR; we return a 501 so the admin
    // sees a clear "wired but not yet implemented" signal instead of
    // a fake success that doesn't actually call anyone.
    return json(
      {
        error: "openai_bridge_not_yet_implemented",
        provider: "openai",
        message:
          "Configuration looks good — Twilio + OPENAI_API_KEY are set. " +
          "The Twilio Media Streams ↔ OpenAI Realtime bridge function " +
          "(voice-call-openai-bridge) hasn't been built yet. Hand this " +
          "to Autocurb engineering to enable.",
      },
      501,
    );
  } catch (err) {
    console.error("[launch-voice-call-openai] handler crashed:", err);
    return json({ error: (err as Error).message || "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
