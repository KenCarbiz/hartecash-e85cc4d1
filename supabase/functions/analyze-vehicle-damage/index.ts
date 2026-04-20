import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DamageItem {
  type: string;       // e.g. "dent", "scratch", "rust", "crack", "paint_chip"
  location: string;   // e.g. "front_bumper", "driver_door", "hood"
  severity: "minor" | "moderate" | "severe";
  description: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submission_id, token, photo_category, photo_path } = await req.json();
    if (!submission_id || !photo_path || !photo_category) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tenant isolation. Anonymous customers (during their own form flow)
    // are allowed — submission_id is a UUID and acts as a capability token.
    // Authenticated staff, however, must belong to the submission's tenant.
    const caller = await resolveCaller(
      req,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      supabaseKey,
    );
    if (caller.kind === "tenant_staff") {
      const { data: subTenant } = await supabase
        .from("submissions")
        .select("dealership_id")
        .eq("id", submission_id)
        .maybeSingle();
      if (subTenant && subTenant.dealership_id !== caller.dealershipId) {
        return forbidden(corsHeaders);
      }
    }

    // Get signed URL for the photo
    const { data: signedData, error: signedErr } = await supabase.storage
      .from("submission-photos")
      .createSignedUrl(photo_path, 300);

    if (signedErr || !signedData?.signedUrl) {
      throw new Error(`Could not get signed URL: ${signedErr?.message}`);
    }

    // Call Lovable AI with the photo for damage analysis
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an automotive appraiser scoring a customer-uploaded photo of a used vehicle being submitted for trade-in. The platform uses your output to adjust a cash offer up or down. Be specific and conservative — false positives reduce a real customer's offer, false negatives cost the dealer money at inspection.

Identify visible damage:
- type: dent, scratch, rust, paint_chip, crack, misaligned_panel, missing_part, stain, tear, wear, other
- location: specific panel (front_bumper, driver_door, hood, roof, rear_quarter_panel, windshield, dashboard, driver_seat, wheel, etc.)
- severity:
  - minor: cosmetic only, barely noticeable from 6 feet (e.g. light swirl marks, single scratch <2 inches, single chip <1 cm, light curb rash)
  - moderate: clearly visible but localized (e.g. door ding, fading clearcoat on one panel, multiple scratches, chipped paint)
  - severe: structural, multiple panels affected, accident damage, deep rust, missing trim, cracked windshield, deployed airbag visible
- description: one short factual sentence

Photo category context: this is the "${'$'}{PHOTO_CATEGORY}" shot — focus your reading on what that angle reveals. (e.g. wheel shots: tire tread/curb rash; rocker panels: rust along sills; dashboard: warning lights, odometer.)

DO NOT flag normal age-appropriate wear (light interior scuffs on an older vehicle, average tire wear, factory-original paint variation) as damage.

Then provide overall judgement:
- overall_severity: none / minor / moderate / severe
- confidence_score: 0-100 — lower if photo is dark, blurry, partial, or off-angle
- suggested_condition: maps to the platform's 4-tier scale used by the offer engine —
    excellent  = no visible damage, looks new (top 3% of cars KBB values)
    very_good  = minor cosmetic only, no functional issues (top 28%)
    good       = moderate cosmetic, repairable, no major mechanical signals (top 50%)
    fair       = severe cosmetic OR visible mechanical signs (rust, panels, fluid, smoke residue)`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Score this "${photo_category}" photo for damage and condition. Be conservative — only flag what is clearly visible. Use the 4-tier scale (excellent / very_good / good / fair) for suggested_condition.`,
              },
              {
                type: "image_url",
                image_url: { url: signedData.signedUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_damage",
              description: "Report the damage assessment results for the vehicle photo.",
              parameters: {
                type: "object",
                properties: {
                  damage_detected: { type: "boolean", description: "Whether any damage was found" },
                  damage_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["dent", "scratch", "rust", "paint_chip", "crack", "misaligned_panel", "missing_part", "stain", "tear", "wear", "other"] },
                        location: { type: "string" },
                        severity: { type: "string", enum: ["minor", "moderate", "severe"] },
                        description: { type: "string" },
                      },
                      required: ["type", "location", "severity", "description"],
                    },
                  },
                  overall_severity: { type: "string", enum: ["none", "minor", "moderate", "severe"] },
                  confidence_score: { type: "number", minimum: 0, maximum: 100 },
                  suggested_condition: { type: "string", enum: ["excellent", "very_good", "good", "fair"] },
                },
                required: ["damage_detected", "damage_items", "overall_severity", "confidence_score", "suggested_condition"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_damage" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Store the damage report
    const { error: insertErr } = await supabase.from("damage_reports").insert({
      submission_id,
      photo_category,
      photo_path,
      ai_model: "gemini-2.5-flash",
      damage_detected: result.damage_detected,
      damage_items: result.damage_items,
      overall_severity: result.overall_severity,
      confidence_score: result.confidence_score,
      suggested_condition: result.suggested_condition,
      raw_response: aiData,
    });

    if (insertErr) {
      console.error("Insert error:", insertErr);
    }

    // After analyzing all photos, update the submission's AI condition summary
    // Fetch all reports for this submission
    const { data: allReports } = await supabase
      .from("damage_reports")
      .select("*")
      .eq("submission_id", submission_id);

    if (allReports && allReports.length > 0) {
      const totalDamageItems = allReports.reduce(
        (acc: DamageItem[], r: any) => [...acc, ...(r.damage_items as DamageItem[])],
        []
      );
      const severeCount = totalDamageItems.filter((d) => d.severity === "severe").length;
      const moderateCount = totalDamageItems.filter((d) => d.severity === "moderate").length;
      const minorCount = totalDamageItems.filter((d) => d.severity === "minor").length;

      let aiCondition = "excellent";
      if (severeCount >= 2) aiCondition = "poor";
      else if (severeCount >= 1 || moderateCount >= 3) aiCondition = "fair";
      else if (moderateCount >= 1 || minorCount >= 3) aiCondition = "good";

      const summaryParts: string[] = [];
      if (severeCount > 0) summaryParts.push(`${severeCount} severe`);
      if (moderateCount > 0) summaryParts.push(`${moderateCount} moderate`);
      if (minorCount > 0) summaryParts.push(`${minorCount} minor`);
      const summary = summaryParts.length > 0
        ? `AI detected ${totalDamageItems.length} issue${totalDamageItems.length !== 1 ? "s" : ""}: ${summaryParts.join(", ")}`
        : "AI: No damage detected";

      await supabase
        .from("submissions")
        .update({ ai_condition_score: aiCondition, ai_damage_summary: summary })
        .eq("id", submission_id);
    }

    return new Response(JSON.stringify({
      success: true,
      damage_detected: result.damage_detected,
      damage_items: result.damage_items,
      overall_severity: result.overall_severity,
      confidence_score: result.confidence_score,
      suggested_condition: result.suggested_condition,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-vehicle-damage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
