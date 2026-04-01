import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BB_PHOTO_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/UsedVehicle/Photo/uvc";

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
    const { year, make, model, style, color, uvc, angle } = await req.json();

    if (!year || !make || !model) {
      return new Response(JSON.stringify({ error: "year, make, and model are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const colorSlug = (color || "white").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const cacheKey = `${year}-${make}-${model}${style ? `-${style}` : ""}-${colorSlug}`.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const storagePath = `vehicle-images/${cacheKey}.png`;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check the DB cache table first
    const { data: cachedRow } = await supabase
      .from("vehicle_image_cache")
      .select("storage_path")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cachedRow?.storage_path) {
      const { data: signedData } = await supabase.storage
        .from("submission-photos")
        .createSignedUrl(cachedRow.storage_path, 60 * 60 * 24 * 30);

      if (signedData?.signedUrl) {
        console.log(`Cache HIT for ${cacheKey}`);
        return new Response(JSON.stringify({ image_url: signedData.signedUrl, cached: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      await supabase.from("vehicle_image_cache").delete().eq("cache_key", cacheKey);
      console.log(`Stale cache entry removed for ${cacheKey}`);
    }

    console.log(`Cache MISS for ${cacheKey}`);

    // 2. Try Black Book photo API first (if UVC provided and year >= 2001)
    let imageBytes: Uint8Array | null = null;
    let imageSource = "ai";
    const bbUsername = Deno.env.get("BLACKBOOK_USERNAME");
    const bbPassword = Deno.env.get("BLACKBOOK_PASSWORD");
    const yearNum = parseInt(year, 10);

    if (uvc && bbUsername && bbPassword && yearNum >= 2001) {
      try {
        const credentials = btoa(`${bbUsername}:${bbPassword}`);
        const bbPhotoUrl = `${BB_PHOTO_BASE}/${encodeURIComponent(uvc)}`;
        console.log(`Trying BB photo for UVC ${uvc}...`);

        const bbRes = await fetch(bbPhotoUrl, {
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Accept": "image/jpeg",
          },
        });

        if (bbRes.ok) {
          const contentType = bbRes.headers.get("content-type") || "";
          if (contentType.includes("image")) {
            const arrayBuf = await bbRes.arrayBuffer();
            if (arrayBuf.byteLength > 1000) { // Sanity check — real photo should be > 1KB
              imageBytes = new Uint8Array(arrayBuf);
              imageSource = "blackbook";
              console.log(`BB photo SUCCESS for ${uvc} (${imageBytes.length} bytes)`);
            }
          }
        } else {
          console.log(`BB photo returned ${bbRes.status} for UVC ${uvc}, falling back to AI`);
        }
      } catch (e) {
        console.log(`BB photo error: ${(e as Error).message}, falling back to AI`);
      }
    }

    // 3. Fall back to AI generation if BB photo unavailable
    let imageDataUrl: string | null = null;

    if (!imageBytes) {
      console.log(`Generating AI image for ${cacheKey}...`);
      const vehicleDesc = `${year} ${make} ${model}${style ? ` ${style}` : ""}`;
      const colorDesc = color && color.toLowerCase() !== "other" ? color : "white";
      const prompt = `A photorealistic three-quarter front angle view of a ${vehicleDesc} in ${colorDesc} color, isolated on a perfectly clean transparent white background with no ground shadow. Professional automotive studio photography, dramatic studio lighting with soft reflections, ultra sharp details, no text or watermarks. The car should be angled slightly toward the viewer showing the front and driver side. The car body color must be clearly ${colorDesc}. High-end dealership hero image style, the vehicle should look premium and aspirational.`;

      const models = [
        "google/gemini-3.1-flash-image-preview",
        "google/gemini-3-pro-image-preview",
      ];

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
            console.log(`Successfully generated image with ${aiModel}`);
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

      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      imageSource = "ai";
    }

    // 4. Upload to storage and register in cache table
    const contentType = imageSource === "blackbook" ? "image/jpeg" : "image/png";
    const ext = imageSource === "blackbook" ? "jpg" : "png";
    const finalStoragePath = `vehicle-images/${cacheKey}.${ext}`;

    supabase.storage
      .from("submission-photos")
      .upload(finalStoragePath, imageBytes!, {
        contentType,
        upsert: true,
      })
      .then(async ({ error: uploadErr }) => {
        if (uploadErr) {
          console.error("Storage upload failed:", uploadErr);
          return;
        }
        const { error: insertErr } = await supabase.from("vehicle_image_cache").upsert({
          cache_key: cacheKey,
          vehicle_year: year,
          vehicle_make: make,
          vehicle_model: model,
          vehicle_style: style || null,
          exterior_color: (color || "white").toLowerCase(),
          storage_path: finalStoragePath,
        }, { onConflict: "cache_key" });

        if (insertErr) console.error("Cache table insert failed:", insertErr);
        else console.log(`Cached ${cacheKey} → ${finalStoragePath} (source: ${imageSource})`);
      });

    // Return immediately
    if (imageSource === "blackbook") {
      // For BB photos, create a signed URL from the uploaded bytes
      // Since upload is fire-and-forget, return a data URL for immediate display
      const base64 = btoa(String.fromCharCode(...imageBytes!));
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      return new Response(JSON.stringify({ image_url: dataUrl, cached: false, source: "blackbook" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ image_url: imageDataUrl, cached: false, source: "ai" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Vehicle image generation error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed to generate vehicle image" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
