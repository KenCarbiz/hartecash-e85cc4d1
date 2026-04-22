import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, forbidden } from "../_shared/auth.ts";

/**
 * Inspector-Note Normalizer.
 *
 * Takes the inspector's free-text notes about what they saw (and an optional
 * severity dropdown: minor | moderate | severe) and returns a structured
 * adjustment that feeds into the OBD repair estimator.
 *
 * Output shape:
 *   { adjustment_pct: -50..+80, confidence: 0..100, summary: string,
 *     key_signals: string[] }
 *
 * Positive pct pushes the recon estimate up (e.g. "cat rattles under load"
 * → +20%). Negative pct pulls it down (e.g. "light came on after a reset
 * but cleared immediately" → -40%). Deterministic layers 1–2 run client-side
 * in obdEstimator.ts; this is layer 3, LLM-assisted.
 *
 * Uses Lovable AI gateway (same Gemini-2.5-Flash model we use for
 * analyze-vehicle-damage) so there's no new vendor or API key to configure.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      notes,
      inspector_severity,
      obd_codes,
      vehicle_summary,
      submission_id,
    } = await req.json();

    if (!notes || typeof notes !== "string" || notes.trim().length < 3) {
      return new Response(
        JSON.stringify({ adjustment_pct: 0, confidence: 0, summary: "", key_signals: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Optional tenant isolation when a submission_id is passed — staff caller
    // must belong to that submission's tenant. Anonymous callers (appraiser
    // mobile tool) are allowed because the submission_id is a UUID.
    if (submission_id) {
      const caller = await resolveCaller(req, supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, serviceKey);
      if (caller.kind === "tenant_staff") {
        const { data } = await supabase
          .from("submissions")
          .select("dealership_id")
          .eq("id", submission_id)
          .maybeSingle();
        if (data && (data as any).dealership_id !== caller.dealershipId) {
          return forbidden(corsHeaders);
        }
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const codesLine = Array.isArray(obd_codes) && obd_codes.length
      ? `OBD codes present: ${obd_codes.join(", ")}`
      : "No OBD codes provided.";
    const severityLine = inspector_severity
      ? `Inspector severity rating: ${inspector_severity}`
      : "Inspector did not rate severity.";
    const vehicleLine = vehicle_summary ? `Vehicle: ${vehicle_summary}` : "";

    const systemPrompt = `You are a used-vehicle recon estimator reviewing an inspector's free-text notes. Your only job is to output an adjustment percent that we apply on top of a baseline OBD-derived repair estimate.

Rules:
- Push UP (positive pct) when notes describe things that ADD likelihood or cost: audible rattles, warning lights active during driving, fluid leaks, smoke, burning smell, overheating, grinding, repeated failures, multiple related symptoms, rough idle, metal shavings, bad tone-ring, seized component.
- Push DOWN (negative pct) when notes describe signals that REDUCE likelihood or cost: "came on after a reset", "cleared after driving", "only after cold start once", "single intermittent code", "trivial fix already applied", "battery disconnected", "loose gas cap tightened", "wire reseated".
- Severity dropdown also informs: minor suggests −10 to +10, moderate suggests 0 to +30, severe suggests +20 to +60.
- Stay within −50 to +80. Cap aggression.
- When notes are vague or unhelpful, return 0 and low confidence.
- Never invent damage the notes don't describe.

Output strictly via the report_adjustment tool. No prose.`;

    const userPrompt = `${vehicleLine}
${codesLine}
${severityLine}

Inspector notes (free text):
"""
${notes.trim()}
"""

Return an adjustment_pct, a 0-100 confidence (lower when notes are vague), a short summary of what you extracted, and key_signals (3-6 phrases copied from the notes that drove the call).`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_adjustment",
              description: "Return the recon-cost adjustment based on the inspector's notes.",
              parameters: {
                type: "object",
                properties: {
                  adjustment_pct: {
                    type: "number",
                    minimum: -50,
                    maximum: 80,
                    description: "Percent to adjust the baseline recon estimate. Negative lowers it, positive raises it.",
                  },
                  confidence: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    description: "How confident you are in the adjustment. Lower for vague notes.",
                  },
                  summary: {
                    type: "string",
                    description: "One short sentence summarizing what the notes told you.",
                  },
                  key_signals: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-6 short phrases lifted from the notes that drove the call.",
                  },
                },
                required: ["adjustment_pct", "confidence", "summary", "key_signals"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_adjustment" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const tc = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) {
      throw new Error("AI returned no tool call");
    }
    const parsed = JSON.parse(tc.function.arguments);

    // Defensive clamp — even though the tool schema enforces bounds, the model
    // occasionally emits wider values and we don't want a bad day to shock
    // the offer engine.
    const adj = Math.max(-50, Math.min(80, Number(parsed.adjustment_pct) || 0));
    const conf = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));

    return new Response(
      JSON.stringify({
        adjustment_pct: adj,
        confidence: conf,
        summary: String(parsed.summary || "").slice(0, 400),
        key_signals: Array.isArray(parsed.key_signals)
          ? parsed.key_signals.slice(0, 6).map((s: unknown) => String(s).slice(0, 120))
          : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("estimate-inspector-note error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
