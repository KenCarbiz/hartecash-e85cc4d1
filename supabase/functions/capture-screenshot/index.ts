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

// Page titles that mean microlink hit a Chrome interstitial / error /
// challenge page instead of the actual dealer site. Case-insensitive.
//
// Updated for cert-error variants observed in the wild — Chrome's
// "Your connection is not private" interstitial sometimes ends up
// with title "Privacy error", sometimes with the bare URL, sometimes
// with NET::ERR_CERT_AUTHORITY_INVALID.
const ERROR_TITLE_PATTERNS = [
  // SSL / cert warnings
  /your connection is not private/i,
  /your connection isn'?t private/i,
  /privacy error/i,
  /privacy warning/i,
  /connection is not secure/i,
  /not secure/i,
  /\bERR_CERT_/i,
  /\bSSL_ERROR/i,
  /\bNET::ERR_/i,
  /certificate (?:error|invalid|expired)/i,
  // Network / DNS / unreachable
  /this site can'?t be reached/i,
  /this page isn'?t working/i,
  /\bDNS_PROBE/i,
  /\bERR_NAME_NOT_RESOLVED/i,
  /\bERR_CONNECTION_/i,
  // Cloudflare / WAF challenge
  /cloudflare/i,
  /attention required/i,
  /just a moment/i,
  /please wait/i,
  /checking your browser/i,
  /access denied/i,
  // SOKAL / DataDome / PerimeterX / Akamai bot-detection challenges
  // ("Verifying the device...", "Verifying you are human", etc.).
  // These never complete for a headless browser; without this match
  // we'd happily return the challenge page as the dealer's site.
  /verifying (the )?device/i,
  /verifying you are human/i,
  /are you a robot/i,
  /please verify/i,
  /human verification/i,
  /bot.?detection/i,
  /\b403\b/,
  /forbidden/i,
  // 404s and server errors
  /\b404\b/,
  /\b500\b/,
  /\b502\b/,
  /\b503\b/,
  /not found/i,
  /server error/i,
  /something went wrong/i,
];

// True if the page title is suspiciously "just the URL" — Chrome
// interstitials sometimes leave the title as the bare hostname when
// rendering an error page that has no <title>.
const titleIsJustHost = (title: string, sourceHost: string): boolean => {
  const t = title.trim().toLowerCase();
  const h = sourceHost.toLowerCase().replace(/^www\./, "");
  return t === h || t === `www.${h}` || t === `https://${h}` || t === `https://www.${h}`;
};

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

    console.log(`[capture-screenshot] Trying ${variants.length} variants for "${url}" in parallel:`, variants);
    // Run variants in PARALLEL with Promise.allSettled rather than
    // serially. Two variants × (10s preflight + 30s microlink) = 80s
    // serial worst-case, which blows past Supabase Edge Runtime's
    // wall-time limit and returns a 502 before our handler can emit
    // a structured failure body. In parallel the worst case is the
    // single slowest attempt (~30-40s) plus the small overhead of
    // both fetches sharing the event loop.
    const results = await Promise.allSettled(variants.map((v) => tryCapture(v)));
    const attempts: CaptureAttempt[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        url: variants[i],
        ok: false,
        reason: `Attempt threw: ${(r.reason as Error)?.message || String(r.reason)}`,
      };
    });
    attempts.forEach((a) => {
      console.log(`[capture-screenshot] Attempt ${a.url}:`, {
        ok: a.ok,
        reason: a.reason,
        pageTitle: a.pageTitle,
        screenshotUrl: a.screenshotUrl,
      });
    });
    // First successful attempt wins (preserves the "with-www first"
    // bias from the previous serial loop because variants[] keeps
    // its order).
    const winner = attempts.find((a) => a.ok);
    if (winner) {
      return json({
        screenshotUrl: winner.screenshotUrl,
        finalUrl: winner.url,
        attempts: attempts.map((x) => ({
          url: x.url,
          ok: x.ok,
          reason: x.reason,
          pageTitle: x.pageTitle,
        })),
      });
    }

    console.warn(`[capture-screenshot] All attempts failed for "${url}":`, attempts);
    // Return 200 (not 502) so supabase-js surfaces the body to the FE
    // instead of throwing a generic FunctionsHttpError. The caller
    // checks `screenshotUrl` to decide success vs failure and reads
    // `attempts[i].reason` for the actionable per-variant diagnostic
    // (rate limit, cert error, CF challenge, 404, etc.). Returning a
    // 5xx swallows the body and the user sees only "non-2xx status
    // code (HTTP 502)" — useless for debugging.
    return json(
      {
        error: "All capture attempts failed",
        attempts: attempts.map((x) => ({
          url: x.url,
          ok: x.ok,
          reason: x.reason,
          pageTitle: x.pageTitle,
          // Include the screenshot URL even on failure — sometimes the
          // junk page (SSL warning) is still informative for debugging.
          screenshotUrl: x.screenshotUrl,
        })),
      },
      200,
    );
  } catch (err) {
    // Top-level safety net. ANY uncaught error becomes a structured
    // 200 with ok:false body so the FE shows the real reason instead
    // of a generic supabase-js "non-2xx status code" wrapper. The
    // only thing that should ever reach the user as a real 5xx is a
    // Supabase Edge Runtime infrastructure failure (function crash
    // / memory limit) — and that's outside our control.
    console.error("[capture-screenshot] handler crashed:", err);
    return json({ error: (err as Error).message || "unknown error" }, 200);
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

// Pre-flight check the URL with Deno's fetch before burning a microlink
// call. Catches the fail modes that microlink "succeeds" on but renders
// the wrong page for: invalid cert (renders Chrome SSL interstitial),
// DNS failure, connection refused, slow / unreachable sites.
//
// Title-pattern matching on microlink's response is fragile — Chrome's
// SSL warning page sometimes emits an empty <title>, sometimes the URL,
// sometimes "Privacy error", and microlink still returns status:success
// with a screenshot of the warning. Pre-flighting at the TLS layer
// catches the cert-error case at the source.
//
// We send a realistic User-Agent so bot-blockers (CF, Akamai) don't
// reject the HEAD request and trick us into thinking the site is dead.
async function preflightCheck(
  url: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const controller = new AbortController();
  // Tightened to 5s (was 10s). Combined with the 25s microlink cap
  // below, worst-case per variant is ~30s, well under Supabase Edge
  // Runtime's wall-time limit even when both variants run.
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    // HEAD first — most servers honor it and it's cheaper than GET.
    // Some misconfigured servers return 405 for HEAD; we don't care
    // about the status, only that TCP+TLS handshake succeeded.
    await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    // Deno surfaces TLS errors as messages mentioning "certificate",
    // "tls", "invalid peer certificate", etc. Classify so the rep gets
    // an actionable diagnostic instead of a raw stack-trace string.
    if (/cert|tls|ssl|trust|handshake/i.test(msg)) {
      return {
        ok: false,
        reason: `Site has an invalid SSL certificate (${msg.slice(0, 120)})`,
      };
    }
    if (/dns|name.*resolv|notfound/i.test(msg)) {
      return { ok: false, reason: `DNS lookup failed for this URL` };
    }
    if (/connection.*(refused|reset|aborted|closed)/i.test(msg)) {
      return { ok: false, reason: `Site refused the connection` };
    }
    if (/abort|timeout|timed.?out/i.test(msg)) {
      return { ok: false, reason: `Site didn't respond within 10s` };
    }
    return { ok: false, reason: `Site unreachable: ${msg.slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}

async function tryCapture(url: string): Promise<CaptureAttempt> {
  // Pre-flight: if the site has a cert error, is unreachable, or DNS
  // fails, microlink would either time out OR (worse) render Chrome's
  // SSL warning page and return it as a "successful" screenshot. Catch
  // those at the TLS layer before spending a microlink quota call.
  const preflight = await preflightCheck(url);
  if (!preflight.ok) {
    return { url, ok: false, reason: preflight.reason };
  }

  // Hit microlink with metadata mode so we get JSON back with the page
  // title — used to detect junk pages (SSL warnings, CF challenges, etc.)
  //
  // waitUntil=load is what the rest of the pipeline (embedDemo.ts) uses
  // and what was working in production before this fix landed. Don't
  // change it without testing — networkidle2 sounds nicer in theory but
  // many dealer sites have analytics beacons and chat widgets that keep
  // the network busy past the 30s microlink timeout, returning blanks.
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

  // Optional Microlink Pro key. When set, bypass the shared 50/day
  // free-tier cap that's hit when the platform sees demo bursts. Set
  // MICROLINK_API_KEY in Supabase function secrets. Without it we use
  // the free tier — same quota every Microlink IP-bucketed user gets.
  const microlinkKey = Deno.env.get("MICROLINK_API_KEY") || "";
  const headers: Record<string, string> = {};
  if (microlinkKey) headers["x-api-key"] = microlinkKey;

  // Hard cap microlink at 25s. Microlink itself defaults to 30s but
  // we'd rather give up gracefully and let the FE retry than have
  // Supabase kill the whole function with a 502. Aborting here lets
  // us return a clean "Site didn't respond within 25s" reason.
  const mlController = new AbortController();
  const mlTimer = setTimeout(() => mlController.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(microlinkUrl, { headers, signal: mlController.signal });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/abort|timeout/i.test(msg)) {
      return { url, ok: false, reason: "Microlink didn't respond within 25s" };
    }
    return { url, ok: false, reason: `Network error: ${msg}` };
  } finally {
    clearTimeout(mlTimer);
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

  // Also reject when the title is suspiciously "just the URL" — Chrome
  // SSL interstitials and hard 404s often emit only the hostname as title.
  try {
    const sourceHost = new URL(url).hostname;
    if (pageTitle && titleIsJustHost(pageTitle, sourceHost)) {
      return {
        url,
        ok: false,
        reason: `Page title is just the hostname ("${pageTitle}") — likely an SSL interstitial or 404`,
        pageTitle,
      };
    }
  } catch {
    // ignore — bad URL parsing isn't a junk-page signal
  }

  return { url, ok: true, screenshotUrl, pageTitle };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
