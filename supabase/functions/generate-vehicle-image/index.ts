import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BB_PHOTO_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/UsedVehicle/Photo/uvc";

// ── Abuse mitigation ─────────────────────────────────────────────
// This function is `verify_jwt = false` in supabase/config.toml so
// the customer-facing landing form can call it without a session.
// That makes it the platform's most expensive open endpoint — each
// cache miss can fan out to a paid Black Book photo call AND up to
// two Gemini image-gen calls (~$0.04 each) via Lovable AI Gateway.
//
// Two soft gates protect the budget without breaking legit traffic:
//
//   1) ALLOWED_ORIGIN_PATTERNS — accept calls whose Origin or Referer
//      matches our domain set (hartecash.com, sell2harte.com, the
//      MotoAcquire trade microsite, *.lovable.app preview URLs,
//      localhost). Casual abusers running curl/scripts won't match
//      and get a 403. Sophisticated abusers will spoof the header
//      but the rate limit catches them next.
//
//   2) In-isolate per-IP rate limiter — 30 requests/min per IP.
//      Each Supabase Edge isolate has its own Map, so a coordinated
//      attack that lands on multiple isolates can exceed 30/min in
//      aggregate. Acceptable trade-off: we don't need a Postgres
//      round-trip on every call, and a per-isolate cap of 30/min
//      still bounds the worst-case spend.
//
// If we ever need stronger guarantees (e.g., the budget burn isn't
// acceptable), promote to a Postgres-backed counter on a small
// edge_request_log table.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/(?:[a-z0-9-]+\.)*hartecash\.com(?::\d+)?(?:\/|$)/i,
  /^https?:\/\/(?:[a-z0-9-]+\.)*sell2harte\.com(?::\d+)?(?:\/|$)/i,
  /^https?:\/\/(?:[a-z0-9-]+\.)*harte\.app(?::\d+)?(?:\/|$)/i,
  /^https?:\/\/[a-z0-9-]+\.lovable\.app(?::\d+)?(?:\/|$)/i,
  /^https?:\/\/[a-z0-9-]+\.lovableproject\.com(?::\d+)?(?:\/|$)/i,
  /^https?:\/\/localhost(?::\d+)?(?:\/|$)/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?(?:\/|$)/i,
];

function isAllowedOrigin(req: Request): boolean {
  const candidates = [req.headers.get("origin"), req.headers.get("referer")]
    .filter((s): s is string => !!s);
  // Server-to-server callers won't have either header. Reject those
  // outright — every legitimate caller is a browser whose Origin or
  // Referer is set by the user agent. (Custom dealer iframes embed
  // the Hartecash widget which forwards Origin correctly.)
  if (candidates.length === 0) return false;
  return candidates.some(c => ALLOWED_ORIGIN_PATTERNS.some(re => re.test(c)));
}

const RATE_LIMIT_PER_MIN = 30;
const RATE_WINDOW_MS = 60_000;
const rateLimitBuckets = new Map<string, number[]>();
function clientIp(req: Request): string {
  // Supabase Edge sits behind Cloudflare; x-forwarded-for is the
  // ordered list of proxies, leftmost = original client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rateLimitBuckets.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_PER_MIN) {
    rateLimitBuckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateLimitBuckets.set(ip, recent);
  // Best-effort garbage collection so the Map doesn't grow forever
  // on a long-lived isolate.
  if (rateLimitBuckets.size > 5000) {
    for (const [k, arr] of rateLimitBuckets) {
      const fresh = arr.filter(t => now - t < RATE_WINDOW_MS);
      if (fresh.length === 0) rateLimitBuckets.delete(k);
      else rateLimitBuckets.set(k, fresh);
    }
  }
  return false;
}

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

  // ── Auth gate (see ALLOWED_ORIGIN_PATTERNS + rate limiter above) ──
  // Origin/Referer check first so we never spend a Postgres round-trip
  // on obvious abuse.
  if (!isAllowedOrigin(req)) {
    console.warn(`[auth-gate] forbidden origin/referer: origin=${req.headers.get("origin")} referer=${req.headers.get("referer")}`);
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    console.warn(`[rate-limit] ip=${ip} exceeded ${RATE_LIMIT_PER_MIN}/min`);
    return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" }
    });
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
    const { year, make, model, style, color, uvc, angle, studio_only } = await req.json();

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

    // 1.5 Color-agnostic cache fallback. Most lookups don't need the
    // exact body color — the vehicle silhouette + trim is what the
    // customer needs to see. If we have ANY cached image of this
    // Y/M/M, serve it immediately so the customer never waits on AI.
    // The frontend's separate per-color cache key still triggers a
    // re-fetch later if/when the color matches.
    const { data: anyColorRow } = studio_only ? { data: null } : await supabase
      .from("vehicle_image_cache")
      .select("storage_path, exterior_color")
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
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 2. Try Black Book photo API first (if UVC provided and year >= 2001)
    let imageBytes: Uint8Array | null = null;
    let imageSource = "ai";
    const bbUsername = Deno.env.get("BLACKBOOK_USERNAME");
    const bbPassword = Deno.env.get("BLACKBOOK_PASSWORD");
    const yearNum = parseInt(year, 10);

    if (!studio_only && uvc && bbUsername && bbPassword && yearNum >= 2001) {
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
