/**
 * analyze-prospect-site
 *
 * Vision-LLM analysis of a prospect dealer's website screenshots, used by
 * the Prospect Demo tool to generate sales-pitch-ready recommendations:
 *
 *   1. Per-page placement reasoning — which embed assets fit, where on
 *      the page, and why (avoiding visual clutter / existing CTAs).
 *   2. Accent color recommendation with WCAG-grounded reasoning.
 *   3. One-line pitch tailored to the dealer's apparent brand voice.
 *
 * Invoked from src/components/admin/ProspectDemo.tsx when the Autocurb
 * salesperson clicks "Get AI Recommendations". Cost is bounded by the
 * single Claude call per request — typically ~$0.03–0.05 per analysis.
 *
 * Body shape:
 *   {
 *     dealerName?: string,
 *     screenshots: { home?: string, listing?: string, vdp?: string },  // microlink URLs
 *     palette?: string[],        // hex codes from algorithmic extraction (optional context)
 *     buttonColor?: string,      // current CTA color for "should I change it" framing
 *   }
 *
 * Returns:
 *   {
 *     pitchLine: string,              // single sentence sales hook
 *     accentColor: { hex, name, reasoning },
 *     pages: {
 *       home?: { placements: [...], skipAssets: [...], notes: string },
 *       listing?: { ... },
 *       vdp?: { ... },
 *     }
 *   }
 *
 * Requires ANTHROPIC_API_KEY. Restricted to platform admins (Autocurb
 * internal staff) — the Prospect Demo tool is gated to "default" tenant.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveCaller } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  dealerName?: string;
  screenshots?: { home?: string; listing?: string; vdp?: string };
  palette?: string[];
  buttonColor?: string;
}

const ASSET_CATALOG = `
Available Autocurb embed assets (the salesperson will toggle these on/off):

- iframe:   Modal trade-in form. Highest-conversion asset; opens in a
            slide-out drawer or new tab when clicked.
- homepage: Full-width hero banner CTA. Sits inside the dealer's hero.
- widget:   Right-edge "tab" widget that's always visible while scrolling.
            Opens the iframe modal on click.
- sticky:   Slim sticky bar at the bottom of the viewport.
- vdp:      Vehicle-detail-page ghost overlay — a "Sell us your trade"
            card injected into the VDP layout near the price.
- listing:  Listing/inventory-page ghost banner — full-width above the
            grid of vehicles.
- button:   Standalone CTA button placed inline within page content.
- ppt:      "Push, Pull, or Tow" promotional badge. Appears next to the
            primary CTA when the dealer runs that promotion.
`.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    // Auth: only platform admins (Autocurb internal staff) can use this.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = await resolveCaller(req, supabaseUrl, anonKey, serviceKey);
    if (caller.kind !== "platform_admin") {
      return json({ error: "Forbidden — platform admin required" }, 403);
    }

    const body: RequestBody = await req.json();
    const screenshots = body.screenshots || {};
    const dealerName = (body.dealerName || "the prospect dealer").trim();
    const palette = body.palette || [];
    const buttonColor = body.buttonColor || "#003B80";

    const pageEntries = (
      [
        ["home", screenshots.home, "Homepage"],
        ["listing", screenshots.listing, "Listing / Inventory Page"],
        ["vdp", screenshots.vdp, "Vehicle Detail Page (VDP)"],
      ] as const
    ).filter(([, url]) => !!url);

    if (pageEntries.length === 0) {
      return json({ error: "No screenshots provided" }, 400);
    }

    // Build a multimodal message with one image per captured page.
    const userContent: Array<Record<string, unknown>> = [];
    userContent.push({
      type: "text",
      text:
        `Analyze the following screenshots from ${dealerName}'s website. ` +
        `Return ONLY a single JSON object matching this exact schema, no prose:\n\n` +
        `{\n` +
        `  "pitchLine": "One short sentence (≤22 words) tailored to this dealer's brand voice that a salesperson can open the call with.",\n` +
        `  "accentColor": {\n` +
        `    "hex": "#RRGGBB",\n` +
        `    "name": "Short label, e.g. 'Action Orange'",\n` +
        `    "reasoning": "1–2 sentences explaining contrast vs the dealer's primary color, with a WCAG-flavored justification."\n` +
        `  },\n` +
        `  "pages": {\n` +
        `    "home"?:    { "placements": ["asset_id with brief 'where + why' reasoning", ...], "skipAssets": ["asset_id: why we'd skip", ...], "notes": "1-2 sentence overall observation" },\n` +
        `    "listing"?: { ... same shape ... },\n` +
        `    "vdp"?:     { ... same shape ... }\n` +
        `  }\n` +
        `}\n\n` +
        ASSET_CATALOG +
        `\n\n` +
        `Context:\n` +
        `- Dealer's current CTA color (algorithmic guess): ${buttonColor}\n` +
        (palette.length > 0
          ? `- Dealer's extracted palette (top-N): ${palette.join(", ")}\n`
          : "") +
        `\n` +
        `Goals:\n` +
        `- Maximize prospect-to-customer conversion when this demo is shown.\n` +
        `- Recommend an accent color that POPS against the dealer's existing palette ` +
        `(orange, lime, magenta, hot red are typical wins; blue-on-blue is a typical fail).\n` +
        `- For each page, name the 1-3 assets that would help most and skip the ones ` +
        `that would visually compete with what's already on the page.\n` +
        `- Pitch line should sound like a senior sales rep, not a brochure. ` +
        `No clichés ("game-changing", "unlock"), no em-dashes.\n` +
        `\nRemember: JSON output only.`,
    });

    for (const [pageKey, url, label] of pageEntries) {
      userContent.push({
        type: "text",
        text: `\n--- ${label} (page key: "${pageKey}") ---`,
      });
      userContent.push({
        type: "image",
        source: { type: "url", url },
      });
    }

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        system:
          "You are a senior automotive-SaaS sales engineer reviewing a prospect dealer's " +
          "website to recommend how Autocurb's embed assets would best be placed for " +
          "maximum click-through. Be specific, ground reasoning in what's visible in " +
          "the screenshots, and never invent UI elements that aren't there. " +
          "Output strict JSON only — no prose, no markdown fences, no commentary.",
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json(
        { error: `Anthropic API ${aiRes.status}`, detail: errText.slice(0, 500) },
        502,
      );
    }

    const aiData = await aiRes.json();
    const rawText: string = (aiData.content?.[0]?.text || "").trim();

    // Strip markdown fences if Claude added them despite instructions.
    const stripped = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stripped);
    } catch (parseErr) {
      console.error("Claude returned non-JSON:", rawText.slice(0, 500));
      return json(
        {
          error: "Vision response wasn't valid JSON",
          detail: rawText.slice(0, 500),
        },
        502,
      );
    }

    return json(parsed);
  } catch (err) {
    return json({ error: (err as Error).message || "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
