// Verify-Shot-Photo — fast quality check on a single boost photo.
//
// Called from CaptureWithOverlay after the customer taps the
// shutter, while they're staring at the local preview. Goal is
// to catch obvious failures (wrong angle, blurry, finger-over-
// lens, all-dark, lens-cap-on) BEFORE the customer hits "Use
// this photo," so they retake instead of submitting a bad shot
// that the appraiser queue will have to reject.
//
// Distinct from analyze-vehicle-damage which does the full
// damage / mileage / condition analysis. This is intentionally
// small + fast — a single yes/no with a one-line reason if no.
//
// Token-authenticated via the same opaque submission token used
// elsewhere in the customer flow. No JWT.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB safety ceiling

interface VerifyBody {
  shot_key: string;     // "exterior_front" | "exterior_driver" | etc.
  image_base64: string; // data URL OR raw base64 of the JPEG
}

interface VerifyResponse {
  ok: boolean;
  reason?: string;
  // When ok=false we surface a customer-facing nudge so the
  // preview screen can show "Try with the whole front in frame"
  // instead of a generic "retake this."
  hint?: string;
}

// Per-shot expectation — what the AI should be looking for.
// Minimal so the LLM doesn't get cute and start scoring damage
// here (that's analyze-vehicle-damage's job).
const SHOT_EXPECTATIONS: Record<string, string> = {
  exterior_front: "the front of a car, showing the grille, headlights, and at least the front bumper. The whole front of the vehicle should be visible.",
  exterior_driver: "the driver-side profile of a car, showing the side from front wheel to rear wheel. Most of the side of the vehicle should be visible.",
  exterior_rear: "the rear of a car, showing the trunk or tailgate, taillights, and rear bumper. The whole rear of the vehicle should be visible.",
  exterior_passenger: "the passenger-side profile of a car, showing the side from front wheel to rear wheel. Most of the side of the vehicle should be visible.",
  dashboard_odometer: "a vehicle's dashboard or instrument cluster taken from the driver seat. The odometer reading should be visible — even partially is OK as long as numbers are legible.",
  tires_wheels: "a close-up of one tire and wheel of a car, showing tread surface and wheel face. Could be any corner of the vehicle.",
  interior_driver_seat: "the driver-side seat of a car, taken from outside the open driver door. The seatback, seat cushion, and side bolsters should be visible — even partial views are acceptable.",
  interior_steering_wheel: "a vehicle's steering wheel, taken straight on from the driver seat. The wheel rim, center hub, and any control buttons should be visible.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "ai_not_configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body?.shot_key || !body?.image_base64) {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expectation = SHOT_EXPECTATIONS[body.shot_key] ||
    "a photo of part of a vehicle";

  // Normalize the image_base64 — accept either a full data URL
  // (with the data:image/jpeg;base64, prefix) or just the raw
  // base64 payload. Reject anything bigger than MAX_IMAGE_BYTES
  // so a misbehaving client can't blow the gateway request size.
  const dataUrl = body.image_base64.startsWith("data:")
    ? body.image_base64
    : `data:image/jpeg;base64,${body.image_base64}`;
  // Rough size check — base64 chars × 0.75 ≈ byte count.
  const approxBytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return new Response(JSON.stringify({ error: "image_too_large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Tight prompt — yes/no + one short reason. No analysis, no
  // damage scoring, no pricing logic. Forced JSON response so
  // we don't have to parse free text.
  const systemPrompt = `You verify whether a customer-uploaded photo is usable for a vehicle trade-in appraisal. Respond with strict JSON only — no prose, no code blocks.

Schema:
  {
    "ok": boolean,
    "reason": string,    // empty when ok=true; one short phrase when ok=false
    "hint": string       // empty when ok=true; one short customer-friendly suggestion when ok=false
  }

ok=true when the photo:
  - Shows ${expectation}
  - Is in focus (not motion-blurred or out-of-focus)
  - Is bright enough that key features are visible
  - Is not obstructed (finger over lens, lens cap on, etc.)
  - Is not a screenshot of another image

ok=false otherwise. Reason should be one of: "wrong_angle", "blurry", "too_dark", "obstructed", "screenshot", "not_a_vehicle", "other".

Hint (only when ok=false) should be a single short customer-facing instruction like "Stand back so the whole front fits" or "Make sure the camera is in focus" or "Try with more light." Never blame the customer.

Be conservative: if the photo is borderline-acceptable, return ok=true. The cost of rejecting a usable photo is higher than accepting a borderline one — a real appraiser reviews everything afterward.`;

  try {
    const aiCtrl = new AbortController();
    const aiTimeout = setTimeout(() => aiCtrl.abort(), 12000);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: aiCtrl.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Verify this ${body.shot_key.replace(/_/g, " ")} photo.` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        // Response-format JSON so we don't have to strip code-fence
        // backticks. Gemini honors this when it can.
        response_format: { type: "json_object" },
      }),
    });
    clearTimeout(aiTimeout);

    if (!aiRes.ok) {
      // Soft-fail to ok=true on AI errors. We don't want a flaky
      // gateway to block the customer's capture flow.
      console.warn(`[verify-shot-photo] AI gateway returned ${aiRes.status}`);
      return new Response(
        JSON.stringify({ ok: true, _ai_unavailable: true } as VerifyResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiRes.json();
    const content: string | undefined = aiData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ ok: true, _ai_no_content: true } as VerifyResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: VerifyResponse;
    try {
      // Gemini sometimes wraps JSON in fences even with response_format
      // set; strip them just in case.
      const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If we can't parse, default to ok=true rather than block.
      return new Response(
        JSON.stringify({ ok: true, _parse_failed: true } as VerifyResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: parsed.ok !== false,
        reason: parsed.reason || undefined,
        hint: parsed.hint || undefined,
      } as VerifyResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[verify-shot-photo] threw:", (e as Error).message);
    // Network / abort / unknown — soft-fail open.
    return new Response(
      JSON.stringify({ ok: true, _ai_threw: true } as VerifyResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
