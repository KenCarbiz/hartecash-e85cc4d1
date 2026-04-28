/**
 * detect-dealer-pages
 *
 * Given a dealer's homepage URL, fetch the HTML server-side, sniff the
 * underlying CMS (Dealer.com, DealerOn, DealerInspire, AutoTrader DDC,
 * etc.), and return the most-likely listing-page URL + a sample VDP URL.
 *
 * Used by the Prospect Demo tool so the salesperson types ONE URL and
 * gets all three captures auto-populated. Runs server-side because most
 * dealer sites either block CORS or serve different content to bots
 * vs. browsers.
 *
 * Body:   { homepage: string }
 * Returns: { listing: string | null, vdp: string | null, cms: string | null }
 *
 * Auth: platform_admin only (matches Prospect Demo gating).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// CMS fingerprints — quick markers in the HTML that identify the
// underlying dealer-website platform. Order matters: we use the first
// match. Generic markers (jQuery, WordPress) come last as fallback.
interface CmsProfile {
  name: string;
  /** Markers (case-insensitive substring) that identify this CMS. */
  markers: string[];
  /** Common path patterns this CMS uses for inventory listings. The
   *  first one that matches a real anchor in the HTML wins. */
  listingPaths: string[];
}

const CMS_PROFILES: CmsProfile[] = [
  {
    name: "Dealer.com",
    markers: ["dealer.com", "ddc-platform", "ddc-content", "ddc-inv"],
    listingPaths: ["/used-vehicles", "/new-inventory", "/used-inventory", "/inventory"],
  },
  {
    name: "DealerOn",
    markers: ["dealeron", "do-content", "dealeron.com"],
    listingPaths: ["/all-inventory", "/used-vehicles", "/new-inventory", "/inventory.htm"],
  },
  {
    name: "DealerInspire",
    markers: ["dealerinspire", "dealer-inspire", "di-content"],
    listingPaths: ["/used-cars", "/new-cars", "/used-inventory", "/inventory"],
  },
  {
    name: "AutoTrader DDC",
    markers: ["autotrader.com/dealers", "atc-platform"],
    listingPaths: ["/used-cars", "/inventory", "/used-vehicles"],
  },
  {
    name: "fusionZONE",
    markers: ["fusionzone", "fzauto"],
    listingPaths: ["/inventory", "/used-vehicles"],
  },
  {
    name: "Generic",
    markers: [], // matches if no specific CMS detected
    listingPaths: [
      "/used-vehicles",
      "/used-cars",
      "/inventory",
      "/preowned",
      "/pre-owned",
      "/used",
      "/all-inventory",
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth — platform admins only.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = await resolveCaller(req, supabaseUrl, anonKey, serviceKey);
    if (caller.kind !== "platform_admin") {
      return json({ error: "Forbidden — platform admin required" }, 403);
    }

    const { homepage } = await req.json();
    if (!homepage || typeof homepage !== "string") {
      return json({ error: "homepage URL required" }, 400);
    }

    let homepageUrl: URL;
    try {
      const candidate = /^https?:\/\//i.test(homepage)
        ? homepage
        : `https://${homepage}`;
      homepageUrl = new URL(candidate);
    } catch {
      return json({ error: "Invalid homepage URL" }, 400);
    }

    // ── SSRF guard ──
    // Block private IPs, loopback, link-local (cloud metadata), multicast,
    // and non-http(s) schemes. Even though the endpoint is platform-admin
    // gated, defense-in-depth — a compromised admin token shouldn't be
    // able to read EC2/GCP metadata or reach internal services.
    if (!/^https?:$/.test(homepageUrl.protocol)) {
      return json({ error: "Only http(s) URLs are allowed" }, 400);
    }
    if (isBlockedHost(homepageUrl.hostname)) {
      return json({ error: "Blocked host (private/loopback/metadata)" }, 400);
    }

    // Fetch with manual redirect handling so we re-validate every hop —
    // an attacker-controlled DNS or 302 to 169.254.169.254 won't slip
    // through. Cap response size to 2 MB and total time to 8s.
    const html = await fetchWithGuards(homepageUrl, 8000, 2 * 1024 * 1024);
    if (html === null) {
      return json({ error: "Couldn't fetch homepage" }, 502);
    }
    const lowerHtml = html.toLowerCase();

    // 1) Identify CMS
    const cms =
      CMS_PROFILES.find(
        (p) => p.markers.length > 0 && p.markers.some((m) => lowerHtml.includes(m)),
      ) || CMS_PROFILES[CMS_PROFILES.length - 1]; // fallback: Generic

    // 2) Find listing URL — pick the first CMS-preferred path that
    //    actually appears in an anchor on the page. Falls back to the
    //    CMS's first preferred path even if not found, since some sites
    //    hide it behind JS-rendered nav menus.
    const anchorPaths = extractAnchorPaths(html, homepageUrl);
    const listingPath =
      cms.listingPaths.find((p) => anchorPaths.includes(p)) ||
      cms.listingPaths[0];
    const listing = listingPath ? new URL(listingPath, homepageUrl).toString() : null;

    // 3) Find a sample VDP — anchors with patterns like /used/<slug>,
    //    /vehicle/<slug>, /vdp/<slug>, /inventory/<digits>, /used-inventory/<slug>
    const vdpRegex =
      /^\/(?:used|new|used-vehicles|new-vehicles|vehicle|vehicles|vdp|inventory|used-inventory|new-inventory)\/[^/?#]+/i;
    const vdpAnchor = anchorPaths.find(
      (p) => vdpRegex.test(p) && p.length > 12 && !p.endsWith(".htm"),
    );
    const vdp = vdpAnchor ? new URL(vdpAnchor, homepageUrl).toString() : null;

    return json({
      listing,
      vdp,
      cms: cms.name,
    });
  } catch (err) {
    return json({ error: (err as Error).message || "unknown error" }, 500);
  }
});

// Reject hostnames that resolve to private / loopback / link-local /
// multicast space, or that look like cloud metadata endpoints. Any
// numeric host that isn't a global-unicast public IP is blocked.
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().trim().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  // IPv4
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, a, b] = v4.map(Number);
    if (a === 0) return true;                              // 0.0.0.0/8
    if (a === 10) return true;                             // 10.0.0.0/8
    if (a === 127) return true;                            // 127.0.0.0/8
    if (a === 169 && b === 254) return true;               // 169.254.0.0/16 (incl. 169.254.169.254 metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;      // 172.16.0.0/12
    if (a === 192 && b === 168) return true;               // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;     // 100.64.0.0/10 (CGNAT)
    if (a >= 224) return true;                             // multicast + reserved
    return false;
  }
  // IPv6 — block unless it looks like a global unicast (2000::/3).
  if (h.includes(":")) {
    if (h === "::1") return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true;     // fc00::/7 ULA
    if (h.startsWith("fe80")) return true;                          // link-local
    if (h.startsWith("ff")) return true;                            // multicast
    if (h.startsWith("::ffff:")) {                                  // IPv4-mapped
      return isBlockedHost(h.replace(/^::ffff:/, ""));
    }
    // any other IPv6 we let through — Deno will surface DNS errors.
  }
  return false;
}

// Manual fetch with size + time cap. Returns the response body as text
// or null on any failure. Re-validates every redirect hop's host to
// prevent DNS-rebinding-style SSRF.
async function fetchWithGuards(
  initialUrl: URL,
  timeoutMs: number,
  maxBytes: number,
): Promise<string | null> {
  let url = initialUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (isBlockedHost(url.hostname)) return null;
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: controller.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        url = new URL(loc, url);
        continue;
      }
      if (!res.ok) return null;
      // Read body with a byte cap.
      const reader = res.body?.getReader();
      if (!reader) return await res.text();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      return new TextDecoder("utf-8", { fatal: false }).decode(merged);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Extract every same-origin anchor href as a path (no querystring/hash).
// Deduplicates and ignores common non-page links (mailto, tel, #anchor).
function extractAnchorPaths(html: string, base: URL): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (
      !raw ||
      raw.startsWith("#") ||
      raw.startsWith("mailto:") ||
      raw.startsWith("tel:") ||
      raw.startsWith("javascript:")
    ) continue;
    try {
      const abs = new URL(raw, base);
      if (abs.host !== base.host) continue;
      const path = abs.pathname.replace(/\/$/, ""); // strip trailing slash
      if (!seen.has(path)) {
        seen.add(path);
        out.push(path);
      }
    } catch {
      // invalid URL → skip
    }
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
