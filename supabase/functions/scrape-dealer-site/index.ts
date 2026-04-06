import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "Firecrawl not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping dealer site:", formattedUrl);

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown", "branding", "links"],
        onlyMainContent: false,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      return new Response(
        JSON.stringify({ error: "Failed to scrape website", detail: scrapeData.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const branding = scrapeData.data?.branding || scrapeData.branding || {};
    const links = scrapeData.data?.links || scrapeData.links || [];
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting dealership information from website content. Extract ALL available information and return it using the provided tool. Be thorough — look for every piece of data: contact info, social links, branding colors, OEM brands sold, business hours, staff/team members with emails, notification-relevant emails, number of locations, taglines, slogans, and any other dealership operational details. If the site mentions departments (service, sales, parts, BDC), extract those contact details too.`,
          },
          {
            role: "user",
            content: `Extract ALL dealership information from this website content. Be as thorough as possible.

WEBSITE URL: ${formattedUrl}
PAGE TITLE: ${metadata.title || ""}

BRANDING DATA:
${JSON.stringify(branding, null, 2)}

LINKS FOUND:
${links.slice(0, 80).join("\n")}

PAGE CONTENT (first 12000 chars):
${markdown.slice(0, 12000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_dealer_info",
              description: "Extract structured dealership information from website content",
              parameters: {
                type: "object",
                properties: {
                  // Section 1: Identity
                  dealership_name: { type: "string", description: "Full dealership name" },
                  tagline: { type: "string", description: "Tagline or slogan if found" },
                  phone: { type: "string", description: "Main phone number" },
                  email: { type: "string", description: "Main contact email" },
                  address: { type: "string", description: "Full street address" },
                  website: { type: "string", description: "Website URL" },
                  google_review: { type: "string", description: "Google review/maps URL if found" },
                  facebook: { type: "string", description: "Facebook page URL" },
                  instagram: { type: "string", description: "Instagram URL" },
                  tiktok: { type: "string", description: "TikTok URL" },
                  youtube: { type: "string", description: "YouTube channel URL" },
                  // Section 2: Architecture
                  architecture: {
                    type: "string",
                    enum: ["Single Store", "Multi-Location", "Dealer Group"],
                    description: "Inferred store architecture based on number of locations/brands",
                  },
                  num_locations: { type: "string", description: "Number of locations found (e.g. '3')" },
                  // Section 3: Branding
                  primary_color: { type: "string", description: "Primary brand color as hex (e.g. #1e3a5f)" },
                  accent_color: { type: "string", description: "Accent/secondary color as hex" },
                  success_color: { type: "string", description: "Success/CTA color as hex (green-ish button color)" },
                  logo_url: { type: "string", description: "URL to the dealership logo image" },
                  // Section 4: Hero content
                   hero_headline: { type: "string", description: "Main hero headline text from the homepage" },
                   hero_subtext: { type: "string", description: "Hero subtext/description from the homepage" },
                   // About us content
                   about_story: { type: "string", description: "The dealership's About Us / Our Story text if found on the page or linked about page. Include the full narrative." },
                   about_hero_headline: { type: "string", description: "About page headline if different from main hero" },
                   // Brands
                  oem_brands: {
                    type: "array",
                    items: { type: "string" },
                    description: "Car brands/makes sold (e.g. Toyota, Honda, Ford)",
                  },
                  // Section 11: Notifications — staff emails
                  staff_emails: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any staff/department email addresses found (sales, service, general, internet, etc.)",
                  },
                  staff_phones: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any staff/department phone numbers found",
                  },
                  // Section 13: Locations
                  locations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        address: { type: "string" },
                        city_state_zip: { type: "string" },
                        brands: { type: "string" },
                        phone: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                    description: "Individual store locations if multi-location",
                  },
                  // Business hours
                  business_hours: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        department: { type: "string", description: "e.g. Sales, Service, Parts — omit if only one set of hours" },
                        days: { type: "string", description: "e.g. Mon-Fri" },
                        hours: { type: "string", description: "e.g. 9:00 AM - 7:00 PM" },
                      },
                    },
                    description: "Business hours by department",
                  },
                  // Section 15: Staff
                  staff_members: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        title: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                      },
                    },
                    description: "Staff/team members found on the site with their roles",
                  },
                  // Additional useful info
                  dealer_group_name: { type: "string", description: "Parent dealer group name if part of a group" },
                  dms_provider: { type: "string", description: "DMS/CRM provider if mentioned (e.g. DealerSocket, CDK, Reynolds)" },
                  stats_years_in_business: { type: "string", description: "Years in business if mentioned" },
                  stats_rating: { type: "string", description: "Google/review rating if mentioned (e.g. 4.8)" },
                  stats_reviews_count: { type: "string", description: "Number of reviews if mentioned" },
                  stats_cars_purchased: { type: "string", description: "Number of cars purchased/sold if mentioned" },
                  established_year: { type: "string", description: "Year the dealership was established/founded (e.g. '1987'). Look for phrases like 'Since 1987', 'Est. 1987', 'Founded in 1987', 'Serving since 1987'." },
                  meta_description: { type: "string", description: "The page meta description from HTML metadata if available" },
                  favicon_url: { type: "string", description: "URL to the site favicon or apple-touch-icon if found" },
                  about_mission: { type: "string", description: "Mission statement if found on the page" },
                  about_values_list: {
                    type: "array",
                    items: { type: "string" },
                    description: "Core values or selling points (e.g. 'Family-owned', 'Award-winning service', 'No-hassle pricing')",
                  },
                  certifications: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any certifications, awards, or accreditations mentioned (e.g. 'BBB A+', 'Edmunds Five Star Dealer')",
                  },
                },
                required: ["dealership_name"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_dealer_info" } },
      }),
    });

    if (!aiRes.ok) {
      const aiErr = await aiRes.text();
      console.error("AI error:", aiRes.status, aiErr);
      return new Response(
        JSON.stringify({ error: "AI extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let extracted = {};

    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    console.log("Extracted dealer info:", JSON.stringify(extracted).slice(0, 500));

    return new Response(
      JSON.stringify({ success: true, data: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("scrape-dealer-site error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
