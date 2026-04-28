/**
 * embed-config
 *
 * PUBLIC endpoint. Returns the runtime embed configuration for a single
 * tenant, by dealership_id, with a short cache so changes inside the
 * Autocurb admin propagate to dealer websites within ~30 seconds.
 *
 * Consumed by /embed-loader.js on the dealer's website. Rendered into
 * the iframe modal / sticky bar / banner / etc. without the dealer's
 * web provider needing to re-install anything.
 *
 * Query: ?tenant=<dealership_id>
 *
 * Response shape:
 *   {
 *     dealershipId: string,
 *     dealerName?: string,
 *     baseUrl: string,        // where the customer-facing iframe lives
 *     buttonColor: string,
 *     buttonText: string,
 *     drawerTitle?: string,
 *     openMode: "drawer" | "new-tab",
 *     widgetPosition?: string,
 *     stickyText?: string, stickyCtaText?: string, stickyPosition?: string,
 *     bannerHeadline?: string, bannerText?: string, bannerCtaText?: string,
 *     pptEnabled: boolean, pptButtonText?: string,
 *     saleBanner?: { active, text, ctaText } | null,
 *     activeAssets: string[],
 *   }
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
    const url = new URL(req.url);
    const tenant =
      url.searchParams.get("tenant") || url.searchParams.get("dealership_id");
    if (!tenant) {
      return json({ error: "tenant query param required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("site_config")
      .select(
        "dealership_id, dealership_name, primary_color, ppt_enabled, ppt_guarantee_amount, embed_config",
      )
      .eq("dealership_id", tenant)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return json({ error: "Tenant not found" }, 404);

    // Convert the dealer's brand HSL primary into a hex if needed.
    const buttonColor =
      (data.embed_config as Record<string, unknown>)?.buttonColor ??
      hslStringToHex(data.primary_color as string) ??
      "#003B80";

    const ec = (data.embed_config as Record<string, unknown>) || {};

    const responseBody = {
      dealershipId: data.dealership_id,
      dealerName: data.dealership_name || null,
      baseUrl:
        (ec.baseUrl as string) || Deno.env.get("PUBLIC_SITE_URL") || "https://hartecash.com",
      buttonColor,
      buttonText: (ec.buttonText as string) || "Get Cash Offer",
      drawerTitle: (ec.drawerTitle as string) || "Get Your Trade-In Value",
      openMode: (ec.openMode as string) || "drawer",
      widgetPosition: (ec.widgetPosition as string) || "bottom-right",
      stickyText: (ec.stickyText as string) || "Get your trade-in value",
      stickyCtaText: (ec.stickyCtaText as string) || "See Value",
      stickyPosition: (ec.stickyPosition as string) || "bottom",
      bannerHeadline: (ec.bannerHeadline as string) || "Have a Trade-In?",
      bannerText:
        (ec.bannerText as string) ||
        "What's your current car worth? Get your trade-in value instantly.",
      bannerCtaText: (ec.bannerCtaText as string) || "Get Trade Value",
      pptEnabled: data.ppt_enabled === true,
      pptButtonText:
        (ec.pptButtonText as string) ||
        `Get Your $${(data.ppt_guarantee_amount || 3000).toLocaleString()} Trade Certificate`,
      saleBanner: (ec.saleBanner as Record<string, unknown>) || null,
      activeAssets:
        (ec.activeAssets as string[]) || ["iframe", "widget", "sticky"],
    };

    // 30-second public cache. Long enough that we don't hammer the DB
    // on busy dealer sites; short enough that admin edits propagate fast.
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return json({ error: (err as Error).message || "unknown error" }, 500);
  }
});

// site_config.primary_color is stored as an HSL string ("213 80% 20%").
// Convert to hex for browser CSS without a runtime HSL→hex shim in the
// dealer's site.
function hslStringToHex(hsl: string | null | undefined): string | null {
  if (!hsl || typeof hsl !== "string") return null;
  const m = hsl.trim().match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  const h = parseFloat(m[1]);
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m_ = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)        { r = c; g = x; }
  else if (h < 120)  { r = x; g = c; }
  else if (h < 180)  { g = c; b = x; }
  else if (h < 240)  { g = x; b = c; }
  else if (h < 300)  { r = x; b = c; }
  else                { r = c; b = x; }
  const to = (n: number) => Math.round((n + m_) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
