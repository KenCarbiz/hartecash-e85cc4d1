/**
 * save-prospect-demo
 *
 * Persists a Prospect Demo snapshot so the rep can share a public link.
 * Generates a short, URL-safe share_token (12 chars, ~71 bits entropy).
 *
 * Body:
 *   {
 *     dealerName?: string,
 *     homeUrl?: string,
 *     listingUrl?: string,
 *     vdpUrl?: string,
 *     screenshots: { home?: string, listing?: string, vdp?: string },
 *     config: <whatever shape; persisted as jsonb>,
 *     pitchLine?: string,
 *     existingId?: string  // when re-saving an open demo
 *   }
 *
 * Returns:
 *   { id: string, shareToken: string, shareUrl: string, expiresAt: string }
 *
 * Auth: platform_admin only.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateShareToken(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceKey) {
      console.error("save-prospect-demo: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({ error: "Server not configured (missing Supabase env vars)" }, 500);
    }

    const caller = await resolveCaller(req, supabaseUrl, anonKey, serviceKey);
    if (caller.kind !== "platform_admin") {
      return json(
        {
          error: caller.kind === "anonymous"
            ? "Sign in as a platform admin to save demos."
            : "Forbidden — only platform admins can save prospect demos.",
        },
        403,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Request body is not valid JSON." }, 400);
    }

    const {
      dealerName,
      homeUrl,
      listingUrl,
      vdpUrl,
      screenshots = {},
      config = {},
      pitchLine,
      existingId,
    } = body as {
      dealerName?: string;
      homeUrl?: string;
      listingUrl?: string;
      vdpUrl?: string;
      screenshots?: { home?: string; listing?: string; vdp?: string };
      config?: Record<string, unknown>;
      pitchLine?: string;
      existingId?: string;
    };

    const supabase = createClient(supabaseUrl, serviceKey);

    let id: string;
    let shareToken: string;
    let expiresAt: string;

    if (existingId) {
      const { data: existing, error: existingErr } = await supabase
        .from("prospect_demos")
        .update({
          dealer_name: dealerName || null,
          home_url: homeUrl || null,
          listing_url: listingUrl || null,
          vdp_url: vdpUrl || null,
          home_screenshot: screenshots.home || null,
          listing_screenshot: screenshots.listing || null,
          vdp_screenshot: screenshots.vdp || null,
          config,
          pitch_line: pitchLine || null,
          // Bump expiry by 30 days from the re-save moment.
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", existingId)
        .select("id, share_token, expires_at")
        .single();

      if (existingErr) throw new Error(existingErr.message);
      if (!existing) throw new Error("Demo not found");
      id = existing.id;
      shareToken = existing.share_token;
      expiresAt = existing.expires_at;
    } else {
      // Try up to 5 times in case of token collision (~71-bit alphabet
      // makes a collision in practice negligible, but be paranoid).
      let inserted = null;
      let attempts = 0;
      while (!inserted && attempts < 5) {
        attempts++;
        shareToken = generateShareToken();
        const { data, error } = await supabase
          .from("prospect_demos")
          .insert({
            share_token: shareToken,
            created_by: caller.userId,
            dealer_name: dealerName || null,
            home_url: homeUrl || null,
            listing_url: listingUrl || null,
            vdp_url: vdpUrl || null,
            home_screenshot: screenshots.home || null,
            listing_screenshot: screenshots.listing || null,
            vdp_screenshot: screenshots.vdp || null,
            config,
            pitch_line: pitchLine || null,
          })
          .select("id, share_token, expires_at")
          .single();
        if (!error) {
          inserted = data;
        } else if (!error.message?.toLowerCase().includes("unique")) {
          throw new Error(error.message);
        }
      }
      if (!inserted) throw new Error("Failed to generate unique share_token");
      id = inserted.id;
      shareToken = inserted.share_token;
      expiresAt = inserted.expires_at;
    }

    return json({ id, shareToken, expiresAt });
  } catch (err) {
    // Log the full error server-side so Supabase function logs show
    // the stack/cause; return a clean message to the client.
    console.error("save-prospect-demo error:", err);
    const e = err as Error & { code?: string; details?: string; hint?: string };
    const detail = [e.message, e.details, e.hint].filter(Boolean).join(" — ");
    return json({ error: detail || "unknown error", code: e.code }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
