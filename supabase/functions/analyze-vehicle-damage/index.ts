import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
            content: `You are an expert automotive appraiser analyzing vehicle photos for damage assessment. 
Analyze the provided vehicle photo and identify ALL visible damage including dents, scratches, rust, paint chips, cracks, missing parts, misaligned panels, and other cosmetic or structural issues.

For each damage item found, provide:
- type: one of "dent", "scratch", "rust", "paint_chip", "crack", "misaligned_panel", "missing_part", "stain", "tear", "wear", "other"
- location: specific area (e.g., "front_bumper", "driver_door", "hood", "roof", "rear_quarter_panel", "windshield", "dashboard", "driver_seat")
- severity: "minor" (cosmetic only, barely noticeable), "moderate" (clearly visible, affects appearance), "severe" (structural or major cosmetic damage)
- description: brief description of the damage

Also provide:
- overall_severity: "none", "minor", "moderate", or "severe" for the photo overall
- confidence_score: 0-100 how confident you are in the assessment
- suggested_condition: one of "excellent", "good", "fair", "poor" based on what you see`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this ${photo_category} vehicle photo for any damage, wear, or condition issues. Be thorough but accurate — don't flag normal wear as damage.`,
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
                  suggested_condition: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
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
