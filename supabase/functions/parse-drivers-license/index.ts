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
      return new Response(JSON.stringify({ error: "imageUrl and submissionToken are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch submission to get dealership_id and check fields
    const { data: submission } = await supabase
      .from("submissions")
      .select("name, address_street, address_city, address_state, token, dealership_id")
      .eq("token", submissionToken)
      .maybeSingle();

    const subDealershipId = (submission as any)?.dealership_id || "default";

    // Check if OCR is enabled for this tenant
    const { data: siteConfig } = await supabase
      .from("site_config")
      .select("enable_dl_ocr")
      .eq("dealership_id", subDealershipId)
      .maybeSingle();

    if (!siteConfig?.enable_dl_ocr) {
      return new Response(JSON.stringify({ skipped: true, reason: "OCR disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch submission to check which fields are empty
    const { data: submission } = await supabase
      .from("submissions")
      .select("name, address_street, address_city, address_state, token")
      .eq("token", submissionToken)
      .maybeSingle();

    if (!submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If all fields are already filled, skip
    const hasName = !!submission.name?.trim();
    const hasStreet = !!submission.address_street?.trim();
    const hasCity = !!submission.address_city?.trim();
    const hasState = !!submission.address_state?.trim();

    if (hasName && hasStreet && hasCity && hasState) {
      return new Response(JSON.stringify({ skipped: true, reason: "All fields already filled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error("Failed to download image");
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Call Gemini via Lovable AI to parse the DL
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
            content: `You are a document OCR specialist. Extract the following fields from the US driver's license image. Return ONLY a JSON object with these fields:
- full_name: The person's full name (First Last format)
- street: Street address
- city: City
- state: Two-letter state abbreviation

If a field is not legible or not present, use null for that field. Return ONLY valid JSON, no markdown.`,
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
                text: "Extract the name and address from this driver's license.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_dl_info",
              description: "Extract name and address from a driver's license",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string", description: "Full name (First Last)" },
                  street: { type: "string", description: "Street address" },
                  city: { type: "string", description: "City" },
                  state: { type: "string", description: "Two-letter state abbreviation" },
                },
                required: ["full_name", "street", "city", "state"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_dl_info" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log("OCR extracted:", extracted);

    // Build update object — only fill empty fields
    const updates: Record<string, string> = {};
    if (!hasName && extracted.full_name) updates.name = extracted.full_name;
    if (!hasStreet && extracted.street) updates.address_street = extracted.street;
    if (!hasCity && extracted.city) updates.address_city = extracted.city;
    if (!hasState && extracted.state) updates.address_state = extracted.state;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "No new data to fill" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update submission
    const { error: updateError } = await supabase
      .from("submissions")
      .update(updates)
      .eq("token", submissionToken);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, updated_fields: Object.keys(updates), extracted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-drivers-license error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
