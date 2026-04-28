/**
 * get-prospect-demo
 *
 * Public endpoint that returns the snapshot of a saved Prospect Demo by
 * share_token. Anonymous; no auth header required. Logs the view if a
 * row was returned.
 *
 * Body or query: { token: string } (POST body or ?token=)
 *
 * Returns: the demo's user-visible fields. NEVER returns created_by,
 * raw IDs of viewers, or any internal-staff info.
 */

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let token: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        token = body.token;
      } catch {
        // ignore malformed JSON; will return below as missing token
      }
    } else {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    }

    if (!token || typeof token !== "string") {
      return json({ error: "token required" }, 400);
    }

    const { data: demo, error } = await supabase
      .from("prospect_demos")
      .select(
        "id, share_token, dealer_name, home_url, listing_url, vdp_url, home_screenshot, listing_screenshot, vdp_screenshot, config, pitch_line, expires_at, created_at",
      )
      .eq("share_token", token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!demo) return json({ error: "Demo not found" }, 404);

    if (demo.expires_at && new Date(demo.expires_at).getTime() < Date.now()) {
      return json({ error: "Demo has expired" }, 410);
    }

    // Log the view (best-effort — don't fail the response if logging fails).
    try {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
      const ua = req.headers.get("user-agent") || "";
      const referrer = req.headers.get("referer") || null;
      // SHA-256 of "ip|ua" so we can dedupe without storing raw PII.
      const visitorHash = await sha256Hex(`${ip}|${ua}`);
      await supabase.from("prospect_demo_views").insert({
        demo_id: demo.id,
        visitor_hash: visitorHash,
        user_agent: ua.slice(0, 250),
        referrer: referrer ? referrer.slice(0, 250) : null,
      });
    } catch (logErr) {
      console.warn("Failed to log demo view:", logErr);
    }

    return json({
      shareToken: demo.share_token,
      dealerName: demo.dealer_name,
      homeUrl: demo.home_url,
      listingUrl: demo.listing_url,
      vdpUrl: demo.vdp_url,
      screenshots: {
        home: demo.home_screenshot,
        listing: demo.listing_screenshot,
        vdp: demo.vdp_screenshot,
      },
      config: demo.config || {},
      pitchLine: demo.pitch_line,
      createdAt: demo.created_at,
      expiresAt: demo.expires_at,
    });
  } catch (err) {
    return json({ error: (err as Error).message || "unknown error" }, 500);
  }
});

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
