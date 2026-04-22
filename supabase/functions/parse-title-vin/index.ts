import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { imageUrl, submissionToken } = await req.json();
    if (!imageUrl || !submissionToken) {
      return new Response(
        JSON.stringify({ error: "imageUrl and submissionToken are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch submission to get VIN on file
    const { data: submission } = await supabase
      .from("submissions")
      .select("vin, vehicle_year, vehicle_make, vehicle_model, token")
      .eq("token", submissionToken)
      .maybeSingle();

    if (!submission) {
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error("Failed to download image");
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Call AI to extract VIN from title
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
            content: `You are a document OCR specialist. Extract the VIN (Vehicle Identification Number) from this vehicle title document. The VIN is a 17-character alphanumeric code. Return ONLY a JSON object with these fields:
- vin: The VIN found on the title (17 characters, uppercase). If not legible, use null.
- owner_name: The registered owner's name if visible. If not legible, use null.

Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
              {
                type: "text",
                text: "Extract the VIN and owner name from this vehicle title.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_title_info",
              description: "Extract VIN and owner from a vehicle title",
              parameters: {
                type: "object",
                properties: {
                  vin: {
                    type: "string",
                    description: "17-character VIN from the title, or null if not legible",
                    nullable: true,
                  },
                  owner_name: {
                    type: "string",
                    description: "Registered owner name, or null if not legible",
                    nullable: true,
                  },
                },
                required: ["vin"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_title_info" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "AI did not return structured data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log("Title OCR extracted:", extracted);

    const titleVin = extracted.vin?.trim().toUpperCase() || null;
    const onFileVin = submission.vin?.trim().toUpperCase() || null;

    // Determine VIN match status
    let vinMatch: "match" | "mismatch" | "no_vin_on_file" | "not_legible" = "not_legible";

    if (!titleVin) {
      vinMatch = "not_legible";
    } else if (!onFileVin) {
      vinMatch = "no_vin_on_file";
      // Auto-populate VIN if not on file
      await supabase
        .from("submissions")
        .update({ vin: titleVin })
        .eq("token", submissionToken);
    } else if (titleVin === onFileVin) {
      vinMatch = "match";
      // Persist VIN verified status
      await supabase
        .from("submissions")
        .update({ vin_verified: true })
        .eq("token", submissionToken);
    } else {
      vinMatch = "mismatch";
      // Log VIN mismatch in activity log
      const { data: subId } = await supabase
        .from("submissions")
        .select("id")
        .eq("token", submissionToken)
        .maybeSingle();

      if (subId) {
        await supabase.from("activity_log").insert({
          submission_id: subId.id,
          action: "VIN Mismatch — Title",
          old_value: onFileVin,
          new_value: titleVin,
          performed_by: "system/ocr",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        vin_match: vinMatch,
        title_vin: titleVin,
        on_file_vin: onFileVin,
        owner_name: extracted.owner_name || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-title-vin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
