import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paidApiGuard } from "../_shared/paidApiGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BB_PHOTO_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/UsedVehicle/Photo/uvc";
const BB_VIN_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/UsedVehicle";

// Wikipedia REST API — free, no key, ~300-500ms response time.
// Most popular vehicles (Camry, Civic, F-150, Armada, etc.) have a
// Wikipedia article whose infobox includes a stock photo. We use the
// summary endpoint to grab the originalimage / thumbnail.
async function fetchWikipediaImage(year: string, make: string, model: string): Promise<Uint8Array | null> {
  // Build progressively-broader search terms. Year-specific titles
  // exist for some redesigns ("2024 Toyota Camry") but most articles
  // are model-only. Try most-specific first.
  const candidates = [
    `${year}_${make}_${model}`,
    `${make}_${model}`,
    `${make}_${model.replace(/\s+/g, "_")}`,
  ];
  for (const title of candidates) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(summaryUrl, {
        signal: ctrl.signal,
        headers: { "User-Agent": "HartecashVehicleLookup/1.0 (https://hartecash.com)" },
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      const imgUrl: string | undefined = data?.originalimage?.source || data?.thumbnail?.source;
      if (!imgUrl) continue;

      // Refuse logos / non-vehicle images. Wikipedia summary returns
      // a page image which for some manufacturer pages is a logo. We
      // sniff via mime + size — vehicle photos are typically > 30KB.
      const imgCtrl = new AbortController();
      const imgTimeout = setTimeout(() => imgCtrl.abort(), 4000);
      const imgRes = await fetch(imgUrl, {
        signal: imgCtrl.signal,
        headers: { "User-Agent": "HartecashVehicleLookup/1.0 (https://hartecash.com)" },
      });
      clearTimeout(imgTimeout);
      if (!imgRes.ok) continue;
      const ct = imgRes.headers.get("content-type") || "";
      if (!ct.startsWith("image/")) continue;
      const buf = await imgRes.arrayBuffer();
      if (buf.byteLength < 8000) continue; // tiny logo / thumbnail
      console.log(`Wikipedia HIT for ${title} (${buf.byteLength} bytes)`);
      return new Uint8Array(buf);
    } catch (e) {
      console.log(`Wikipedia attempt for "${title}" failed: ${(e as Error).message}`);
    }
  }
  return null;
}

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
    const { year, make, model, style, color, uvc, vin, angle, studio_only } = await req.json();

    if (!year || !make || !model) {
      return new Response(JSON.stringify({ error: "year, make, and model are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const colorSlug = (color || "white").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const angleSlug = angle === "side" ? "side" : "3q";
    // studio_only forces AI-generated white-background renders only
    // (skips Wikipedia + Black Book photos that may have real-world
    // backgrounds). Cache key is suffixed so it doesn't collide with
    // the standard pipeline.
    const studioSuffix = studio_only ? "-studio" : "";
    const cacheKey = `${year}-${make}-${model}${style ? `-${style}` : ""}-${colorSlug}-${angleSlug}${studioSuffix}`.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const storagePath = `vehicle-images/${cacheKey}.png`;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check the DB cache table first
    const { data: cachedRow } = await supabase
      .from("vehicle_image_cache")
      .select("storage_path, image_source")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cachedRow?.storage_path) {
      const { data: signedData } = await supabase.storage
        .from("submission-photos")
        .createSignedUrl(cachedRow.storage_path, 60 * 60 * 24 * 30);

      if (signedData?.signedUrl) {
        console.log(`Cache HIT for ${cacheKey}`);
        return new Response(JSON.stringify({ image_url: signedData.signedUrl, cached: true, source: cachedRow.image_source ?? null }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      await supabase.from("vehicle_image_cache").delete().eq("cache_key", cacheKey);
      console.log(`Stale cache entry removed for ${cacheKey}`);
    }

    console.log(`Cache MISS for ${cacheKey}`);

    // 1.5 Color-agnostic cache fallback. Most lookups don't need the
    // exact body color — the vehicle silhouette + trim is what the
    // customer needs to see. If we have ANY cached image of this
    // Y/M/M, serve it immediately so the customer never waits on AI.
    // The frontend's separate per-color cache key still triggers a
    // re-fetch later if/when the color matches.
    const { data: anyColorRow } = studio_only ? { data: null } : await supabase
      .from("vehicle_image_cache")
      .select("storage_path, exterior_color, image_source")
      .eq("vehicle_year", String(year))
      .eq("vehicle_make", make)
      .eq("vehicle_model", model)
      .limit(1)
      .maybeSingle();

    if (anyColorRow?.storage_path) {
      const { data: signedData } = await supabase.storage
        .from("submission-photos")
        .createSignedUrl(anyColorRow.storage_path, 60 * 60 * 24 * 30);
      if (signedData?.signedUrl) {
        console.log(`Color-agnostic cache HIT for ${year} ${make} ${model} (${anyColorRow.exterior_color})`);
        return new Response(JSON.stringify({
          image_url: signedData.signedUrl,
          cached: true,
          color_fallback: true,
          fallback_color: anyColorRow.exterior_color,
          source: anyColorRow.image_source ?? null,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 2. Try Black Book photo API first (the exact-vehicle photo).
    let imageBytes: Uint8Array | null = null;
    let imageSource = "ai";
    const bbUsername = Deno.env.get("BLACKBOOK_USERNAME");
    const bbPassword = Deno.env.get("BLACKBOOK_PASSWORD");
    const yearNum = parseInt(year, 10);
    const bbCreds = bbUsername && bbPassword ? btoa(`${bbUsername}:${bbPassword}`) : "";

    // Resolve the BB UVC for the exact vehicle. Prefer the uvc passed
    // in; otherwise decode the VIN via Black Book. The customer portal
    // only has the VIN (the uvc isn't persisted), so this VIN→uvc step
    // is what lets the portal show the exact-VIN BB photo instead of a
    // generic model shot.
    let resolvedUvc: string = (uvc as string) || "";
    if (!studio_only && !resolvedUvc && vin && bbCreds && yearNum >= 2001) {
      try {
        const vinRes = await fetch(`${BB_VIN_BASE}/VIN/${encodeURIComponent(vin)}?template=11`, {
          headers: { "Authorization": `Basic ${bbCreds}`, "Accept": "application/json" },
        });
        if (vinRes.ok) {
          const vinJson = await vinRes.json();
          resolvedUvc = vinJson?.used_vehicles?.used_vehicle_list?.[0]?.uvc || "";
          if (resolvedUvc) console.log(`Resolved UVC ${resolvedUvc} from VIN for BB photo`);
          else console.log("BB VIN decode returned no uvc for photo");
        } else {
          console.log(`BB VIN decode for photo returned ${vinRes.status}`);
        }
      } catch (e) {
        console.log(`BB VIN decode error: ${(e as Error).message}`);
      }
    }

    if (!studio_only && resolvedUvc && bbCreds && yearNum >= 2001) {
      try {
        const bbPhotoUrl = `${BB_PHOTO_BASE}/${encodeURIComponent(resolvedUvc)}`;
        console.log(`Trying BB photo for UVC ${resolvedUvc}...`);

        const bbRes = await fetch(bbPhotoUrl, {
          headers: {
            "Authorization": `Basic ${bbCreds}`,
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
              console.log(`BB photo SUCCESS for ${resolvedUvc} (${imageBytes.length} bytes)`);
            }
          }
        } else {
          console.log(`BB photo returned ${bbRes.status} for UVC ${resolvedUvc}, falling back to AI`);
        }
      } catch (e) {
        console.log(`BB photo error: ${(e as Error).message}, falling back to AI`);
      }
    }

    // 3. Wikipedia infobox — free, fast (~500ms), high hit rate for
    //    common cars. Tried before AI so we don't burn 10-30s on
    //    Gemini for vehicles Wikipedia already has a clean photo of.
    //    Skipped in studio_only mode (Wikipedia photos have real
    //    backgrounds that won't key cleanly).
    if (!imageBytes && !studio_only) {
      const wikiBytes = await fetchWikipediaImage(String(year), make, model);
      if (wikiBytes) {
        imageBytes = wikiBytes;
        imageSource = "wikipedia";
      }
    }

    // 4. Fall back to AI generation as last resort
    let imageDataUrl: string | null = null;

    if (!imageBytes) {
      console.log(`Generating AI image for ${cacheKey}...`);
      const vehicleDesc = `${year} ${make} ${model}${style ? ` ${style}` : ""}`;
      const colorDesc = color && color.toLowerCase() !== "other" ? color : "white";
      const angleDesc = angle === "side"
        ? "a photorealistic direct side profile view"
        : "a photorealistic three-quarter front angle view";
      const angleInstruction = angle === "side"
        ? "The car should be viewed from directly the side, showing the full length of the vehicle in a clean profile shot."
        : "The car should be angled slightly toward the viewer showing the front and driver side.";
      // Prompt note: never say "transparent" here — AI image
      // models often interpret that literally as the checkered
      // placeholder pattern image editors use to indicate
      // transparency. Always anchor to a pure-white solid background
      // so the result composites cleanly onto our white pages.
      const prompt = `${angleDesc} of a ${vehicleDesc} in ${colorDesc} color, isolated on a pure solid white background (#FFFFFF) with absolutely no checkered pattern, no grid, no shadow, and no ground reflection. Professional automotive studio photography, dramatic studio lighting with soft reflections, ultra sharp details, no text or watermarks. ${angleInstruction} The car body color must be clearly ${colorDesc}. High-end dealership hero image style, the vehicle should look premium and aspirational. The background must be uniform, plain, solid white — never transparent, never checkered.`;

      const models = [
        "google/gemini-3.1-flash-image-preview",
        "google/gemini-3-pro-image-preview",
      ];

      let lastError = "";

      for (const aiModel of models) {
        try {
          // 15s per-model cap. Gemini sometimes hangs longer than
          // 30s and the customer is staring at a spinner; better to
          // bail and try the next model (or fall through to the
          // graceful 404 below) than block.
          const ctrl = new AbortController();
          const timeoutId = setTimeout(() => ctrl.abort(), 15000);
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            signal: ctrl.signal,
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
          clearTimeout(timeoutId);

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
        // Graceful no-image response — frontend already handles a
        // 200 with image_url:null by showing the camera icon instead
        // of looking broken. Better than a 500 that triggers the
        // toast / "unavailable" red state.
        console.warn(`All AI models failed for ${cacheKey}: ${lastError}`);
        return new Response(JSON.stringify({
          image_url: null,
          error: "image_unavailable",
          detail: lastError,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
      imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      imageSource = "ai";
    }

    // 5. Upload to storage and register in cache table.
    //    BB returns JPEG, Wikipedia is usually JPEG (sometimes PNG
    //    or WebP), AI returns PNG. JPEG is the safe default for the
    //    non-AI path since it covers all the common cases.
    const contentType = imageSource === "ai" ? "image/png" : "image/jpeg";
    const ext = imageSource === "ai" ? "png" : "jpg";
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
          image_source: imageSource,
        }, { onConflict: "cache_key" });

        if (insertErr) console.error("Cache table insert failed:", insertErr);
        else console.log(`Cached ${cacheKey} → ${finalStoragePath} (source: ${imageSource})`);
      });

    // Return immediately. Storage upload is fire-and-forget so for
    // BB and Wikipedia we hand back a data URL of the bytes we
    // already have in memory — no second round-trip to fetch the
    // freshly-uploaded file.
    if (imageSource !== "ai") {
      const base64 = btoa(String.fromCharCode(...imageBytes!));
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      return new Response(JSON.stringify({ image_url: dataUrl, cached: false, source: imageSource }), {
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
