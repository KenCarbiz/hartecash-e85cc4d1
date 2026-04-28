/**
 * capture-screenshot
 *
 * Server-side wrapper around microlink.io. Solves three problems the
 * client-side direct call has:
 *   1. Microlink sometimes returns an OK status with the screenshot
 *      pointing at a Chrome SSL warning / 404 / cert error page —
 *      indistinguishable on the client. We use microlink's metadata
 *      JSON to detect those cases by page title and reject them.
 *   2. Many dealer sites canonicalize to www.* and reject the bare
 *      domain (or vice-versa). We try both variants and use the first
 *      one that returns a real page.
 *   3. Server-side calls don't burn the salesperson's office IP
 *      against microlink's free 50/day per-IP cap — they all share
 *      the edge-function's IP, which still has the same cap but pools
 *      across the whole sales team.
 *
 * Body: { url: string }
 * Returns: { screenshotUrl: string } | { error: string }
 *
 * Auth: any authenticated user (per-tenant Live Preview AND the
 * platform-only Prospect Demo both call this).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Page titles that mean microlink hit an error page. Case-insensitive.
const ERROR_TITLE_PATTERNS = [
  /your connection is not private/i,
  /privacy error/i,
  /this site can't be reached/i,
  /404\b/,
  /not found/i,
  /access denied/i,
  /forbidden/i,
  /server error/i,
  /cloudflare/i, // CF challenge / "Just a moment..."
  /attention required/i,
  /just a moment/i,
];

interface CaptureAttempt {
  url: string;
  ok: boolean;
  screenshotUrl?: string;
  reason?: string;
  pageTitle?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: any authenticated user. The capture itself isn't sensitive,
    // we just don't want anonymous traffic burning microlink quota.
    const caller = await resolveCaller(req, supabaseUrl, anonKey, serviceKey);
    if (caller.kind === "anonymous") {
      return json({ error: "Authentication required" }, 401);
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return json({ error: "url required" }, 400);
    }

    // Generate URL variants to try: as-typed, with-www, without-www.
    const variants = generateVariants(url);
    if (variants.length === 0) {
      return json({ error: "Invalid URL" }, 400);
    }

    const attempts: CaptureAttempt[] = [];
    for (const v of variants) {
      const a = await tryCapture(v);
      attempts.push(a);
      if (a.ok) {
        return json({
          screenshotUrl: a.screenshotUrl,
          finalUrl: a.url,
          attempts: attempts.map((x) => ({
            url: x.url,
            ok: x.ok,
            reason: x.reason,
            pageTitle: x.pageTitle,
          })),
        });
      }
    }

    return json(
      {
        error: "All capture attempts failed",
        attempts: attempts.map((x) => ({
          url: x.url,
          ok: x.ok,
          reason: x.reason,
          pageTitle: x.pageTitle,
        })),
      },
      502,
    );
  } catch (err) {
    return json({ error: (err as Error).message || "unknown error" }, 500);
  }
});

function generateVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return [];
  }
  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".")) return [];
  const variants = new Set<string>();
  variants.add(parsed.toString());
  // Add www. variant if not already on www
  if (!host.startsWith("www.")) {
    const u = new URL(parsed.toString());
    u.hostname = `www.${host}`;
    variants.add(u.toString());
  } else {
    // Add bare-domain variant
    const u = new URL(parsed.toString());
    u.hostname = host.replace(/^www\./, "");
    variants.add(u.toString());
  }
  return Array.from(variants);
}

async function tryCapture(url: string): Promise<CaptureAttempt> {
  // Hit microlink with metadata mode so we get JSON back with the page
  // title — used to detect junk pages (SSL warnings, CF challenges, etc.)
  const params = new URLSearchParams({
    url,
    screenshot: "true",
    "viewport.width": "1280",
    "viewport.height": "800",
    type: "png",
    waitUntil: "load",
    "screenshot.fullPage": "false",
    hide:
      "[id*='cookie'],[class*='cookie-banner'],[class*='consent']," +
      "[id*='onetrust'],[class*='tcf-banner'],iframe[src*='intercom']," +
      "iframe[src*='drift'],[id*='hubspot-messages'],[class*='livechat']",
  });
  const microlinkUrl = `https://api.microlink.io?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(microlinkUrl);
  } catch (e) {
    return { url, ok: false, reason: `Network error: ${(e as Error).message}` };
  }

  if (!res.ok) {
    if (res.status === 429) {
      return { url, ok: false, reason: "Microlink rate limit (50/day)" };
    }
    return { url, ok: false, reason: `Microlink returned ${res.status}` };
  }

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    return { url, ok: false, reason: "Microlink returned non-JSON" };
  }

  if (data.status !== "success") {
    return {
      url,
      ok: false,
      reason: `Microlink: ${(data.message as string) || data.status || "unknown"}`,
    };
  }

  const inner = (data.data as Record<string, unknown>) || {};
  const screenshotUrl = ((inner.screenshot as Record<string, unknown>)?.url ||
    null) as string | null;
  const pageTitle = (inner.title as string) || "";

  if (!screenshotUrl) {
    return { url, ok: false, reason: "Microlink returned no screenshot URL", pageTitle };
  }

  // Detect SSL warnings, CF challenges, 404s, etc. via the page title
  // microlink saw when rendering. If it matches a known-junk pattern,
  // reject so the caller can try the next variant.
  if (pageTitle && ERROR_TITLE_PATTERNS.some((p) => p.test(pageTitle))) {
    return {
      url,
      ok: false,
      reason: `Page rendered as error: "${pageTitle}"`,
      pageTitle,
    };
  }

  return { url, ok: true, screenshotUrl, pageTitle };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
