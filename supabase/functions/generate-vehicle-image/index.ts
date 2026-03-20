import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { year, make, model, style, color } = await req.json();

    if (!year || !make || !model) {
      return new Response(JSON.stringify({ error: "year, make, and model are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Include color in cache key so each color gets its own image
    const colorSlug = (color || "white").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const cacheKey = `${year}-${make}-${model}${style ? `-${style}` : ""}-${colorSlug}`.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const storagePath = `vehicle-images/${cacheKey}.png`;

    // Check if image already exists in storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await supabase.storage
      .from("submission-photos")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

    if (existing?.signedUrl) {
      return new Response(JSON.stringify({ image_url: existing.signedUrl, cached: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Generate image via AI with the specified color
    const vehicleDesc = `${year} ${make} ${model}${style ? ` ${style}` : ""}`;
    const colorDesc = color && color.toLowerCase() !== "other" ? color : "white";
    const prompt = `A photorealistic side profile view of a ${vehicleDesc} car in ${colorDesc} color, on a clean solid white background. Professional automotive photography style, studio lighting, sharp details, no text or watermarks. The car should be facing right. The car body color must be clearly ${colorDesc}. Clean isolated vehicle shot suitable for a car dealership website.`;

    const models = [
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview",
      "google/gemini-2.5-flash-image",
    ];

    let imageDataUrl: string | null = null;
    let lastError = "";

    for (const aiModel of models) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!aiRes.ok) {
          lastError = `${aiModel} failed [${aiRes.status}]`;
          console.log(`Model ${aiModel} failed with ${aiRes.status}, trying next...`);
          continue;
        }

        const aiData = await aiRes.json();
        imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imageDataUrl) {
          console.log(`Successfully generated ${colorDesc} image with ${aiModel}`);
          break;
        }
      } catch (e) {
        lastError = `${aiModel}: ${(e as Error).message}`;
        console.log(`Model ${aiModel} threw error, trying next...`);
      }
    }

    if (!imageDataUrl) {
      throw new Error(`All models failed. Last: ${lastError}`);
    }

    // Extract base64 data and upload to storage
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const { error: uploadErr } = await supabase.storage
      .from("submission-photos")
      .upload(storagePath, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload failed:", uploadErr);
      return new Response(JSON.stringify({ image_url: imageDataUrl, cached: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get a signed URL for the stored image
    const { data: signedData } = await supabase.storage
      .from("submission-photos")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

    const finalUrl = signedData?.signedUrl || imageDataUrl;

    return new Response(JSON.stringify({ image_url: finalUrl, cached: false }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Vehicle image generation error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed to generate vehicle image" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
