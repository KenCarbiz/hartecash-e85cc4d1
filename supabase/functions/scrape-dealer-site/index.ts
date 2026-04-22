import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Scrape a single URL via Firecrawl */
async function scrapePage(
  url: string,
  firecrawlKey: string,
  formats: string[] = ["markdown"],
  onlyMainContent = true
): Promise<{ markdown: string; branding: any; links: string[]; metadata: any }> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats, onlyMainContent }),
  });
  const data = await res.json();
  return {
    markdown: data.data?.markdown || data.markdown || "",
    branding: data.data?.branding || data.branding || {},
    links: data.data?.links || data.links || [],
    metadata: data.data?.metadata || data.metadata || {},
  };
}

/** Use Firecrawl map to discover site URLs */
async function mapSite(url: string, firecrawlKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, limit: 200, includeSubdomains: true }),
    });
    const data = await res.json();
    return data.links || [];
  } catch (e) {
    console.error("Map failed:", e);
    return [];
  }
}

/** Find relevant sub-pages from the sitemap */
function findRelevantPages(links: string[], baseUrl: string): Record<string, string | null> {
  const lower = (s: string) => s.toLowerCase();
  const find = (patterns: string[]) => {
    for (const p of patterns) {
      const match = links.find((l) => {
        const path = lower(l).replace(lower(baseUrl), "");
        return path.includes(p) && !path.includes("blog") && !path.includes("news");
      });
      if (match) return match;
    }
    return null;
  };

  return {
    about: find(["about-us", "about", "our-story", "our-history", "history", "who-we-are"]),
    hours: find(["hours", "hours-directions", "hours-and-directions", "contact-us", "directions"]),
    staff: find(["staff", "team", "our-team", "meet-our-team", "employees", "leadership"]),
    contact: find(["contact", "contact-us", "get-in-touch"]),
    service: find(["service", "service-department", "service-center", "auto-service"]),
    tradein: find(["trade-in", "trade", "value-your-trade", "sell-your-car", "sell-my-car", "appraise", "instant-offer"]),
    reviews: find(["reviews", "testimonials", "customer-reviews"]),
    community: find(["community", "giving-back", "philanthropy", "sponsorship", "involvement"]),
  };
}

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

    // Step 1: Map the site to discover pages + scrape homepage simultaneously
    const [siteLinks, homepage] = await Promise.all([
      mapSite(formattedUrl, firecrawlKey),
      scrapePage(formattedUrl, firecrawlKey, ["markdown", "branding", "links"], false),
    ]);

    // Merge links from map and homepage
    const allLinks = [...new Set([...siteLinks, ...homepage.links])];
    console.log(`Found ${allLinks.length} site URLs`);

    // Step 2: Identify and scrape relevant sub-pages (expanded list)
    const relevantPages = findRelevantPages(allLinks, formattedUrl);
    console.log("Relevant pages:", JSON.stringify(relevantPages));

    const subPageContent: string[] = [];
    const pagesToScrape = Object.entries(relevantPages)
      .filter(([, url]) => url !== null)
      .map(([label, pageUrl]) => ({ label, url: pageUrl! }));

    // Scrape up to 6 sub-pages in parallel
    if (pagesToScrape.length > 0) {
      const results = await Promise.all(
        pagesToScrape.slice(0, 6).map(async ({ label, url: pageUrl }) => {
          try {
            console.log(`Scraping ${label} page: ${pageUrl}`);
            const result = await scrapePage(pageUrl, firecrawlKey, ["markdown"], true);
            return `\n\n--- ${label.toUpperCase()} PAGE (${pageUrl}) ---\n${result.markdown.slice(0, 6000)}`;
          } catch (e) {
            console.error(`Failed to scrape ${label}:`, e);
            return "";
          }
        })
      );
      subPageContent.push(...results.filter(Boolean));
    }

    const combinedContent = [
      homepage.markdown.slice(0, 12000),
      ...subPageContent,
    ].join("\n");

    console.log(`Total content length: ${combinedContent.length} chars`);

    // Step 3: AI extraction with enriched content
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
            content: `You are an expert at extracting dealership information from website content. You are given the HOMEPAGE plus sub-pages (About, Hours, Staff, Contact, Service, Trade-In, Reviews, Community) when available. Extract ALL available information using the provided tool. Be extremely thorough — the more you extract, the less the dealer has to manually enter during onboarding.

KEY EXTRACTION TARGETS:
- **Identity**: Dealership name, tagline/slogan, phone, email, address, website
- **Social**: Google reviews link, Facebook, Instagram, TikTok, YouTube, LinkedIn, X/Twitter
- **Branding**: Primary, accent, success colors from CSS/branding. Logo URL, white/dark logo URL, favicon
- **Architecture**: How many locations, whether it's a single store, multi-location, or dealer group
- **Hours**: Sales hours AND Service hours separately. Look for "Sales Hours", "Service Hours", "Parts Hours" sections. Also general hours. Format as structured entries.
- **About/Story**: Full narrative from the About page. Include founding story, mission, values, what makes them different.
- **About Headline**: The main heading on the About page (e.g. "Our Story", "About Us", "Family-Owned Since 1952")
- **About Subtext**: A subtitle or short paragraph under the About headline
- **Milestones/Timeline**: Historical events, awards, expansions, acquisitions in chronological order
- **Established Year**: CRITICAL — search EVERYWHERE: footer copyright, about page, hero, tagline, "Since YYYY", "Est. YYYY", "Founded YYYY", "Family-owned since YYYY", "[X] years of experience" → calculate year
- **Trust Stats**: Google rating, review count, cars sold/purchased, awards won
- **Staff**: Names, titles, emails, phones. Also department emails like internet@dealer.com, service@dealer.com
- **Locations**: All store locations with full addresses, brands, phones, emails
- **OEM Brands**: All car makes sold or serviced
- **Community**: Any community involvement, sponsorships, charity work, local partnerships
- **Certifications**: Awards, accreditations, recognitions
- **Service Offerings**: Buy cars, trade-ins, sell cars, service, parts, body shop, financing
- **Service Landing Copy**: Any "service drive" or "service customer" specific messaging
- **Trade-In Copy**: Any "trade in your car" or "value your trade" specific messaging. Often found on trade-in or sell-your-car pages
- **Testimonials/Reviews**: Customer quotes, star ratings, review snippets — up to 5
- **Meta**: Page description, favicon URL, DMS/CRM provider if visible
- **Referral Program**: Any mention of referral bonuses or programs`,
          },
          {
            role: "user",
            content: `Extract ALL dealership information from this website. Be as thorough as possible. Multiple pages are included below. The goal is to pre-fill as much of the dealership onboarding as possible so they don't have to type anything.

WEBSITE URL: ${formattedUrl}
PAGE TITLE: ${homepage.metadata.title || ""}
META DESCRIPTION: ${homepage.metadata.description || ""}

BRANDING DATA:
${JSON.stringify(homepage.branding, null, 2)}

LINKS FOUND ON SITE (${allLinks.length} total):
${allLinks.slice(0, 100).join("\n")}

FULL WEBSITE CONTENT:
${combinedContent}`,
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
                  architecture: {
                    type: "string",
                    enum: ["Single Store", "Multi-Location", "Dealer Group"],
                    description: "Inferred store architecture based on number of locations/brands",
                  },
                  num_locations: { type: "string", description: "Number of locations found" },
                  primary_color: { type: "string", description: "Primary brand color as hex (e.g. #1e3a5f)" },
                  accent_color: { type: "string", description: "Accent/secondary color as hex" },
                  success_color: { type: "string", description: "Success/CTA button color as hex" },
                  logo_url: { type: "string", description: "URL to the dealership logo image (light/standard version)" },
                  logo_white_url: { type: "string", description: "URL to the white/dark-mode version of the logo if found" },
                  favicon_url: { type: "string", description: "URL to the site favicon" },
                  hero_headline: { type: "string", description: "Main hero headline text from the homepage" },
                  hero_subtext: { type: "string", description: "Hero subtext/description from the homepage" },
                  // Service & Trade landing copy
                  service_hero_headline: { type: "string", description: "Headline for service-drive customers, e.g. 'There's Never Been a Better Time to Upgrade'. Look on service pages or any service-customer messaging." },
                  service_hero_subtext: { type: "string", description: "Subtext for service landing page" },
                  trade_hero_headline: { type: "string", description: "Headline for trade-in page, e.g. 'Value Your Trade'. Look on trade-in, sell-your-car, or appraisal pages." },
                  trade_hero_subtext: { type: "string", description: "Subtext for trade-in landing page" },
                  // About page
                  about_story: { type: "string", description: "Full About Us / Our Story narrative. Include the complete founding story, history, mission, and what makes them different." },
                  about_hero_headline: { type: "string", description: "About page main headline (e.g. 'Our Story', 'About Us')" },
                  about_hero_subtext: { type: "string", description: "About page subtitle or short intro paragraph" },
                  about_mission: { type: "string", description: "Mission statement if found" },
                  about_values_list: {
                    type: "array",
                    items: { type: "string" },
                    description: "Core values or selling points (e.g. 'Family-owned', 'Award-winning service', 'Transparent pricing')",
                  },
                  about_milestones: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        year: { type: "string", description: "Year of the milestone (e.g. '1987')" },
                        label: { type: "string", description: "Description of what happened (e.g. 'Founded by John Smith')" },
                      },
                    },
                    description: "Timeline milestones — founding, expansions, awards, key events in chronological order",
                  },
                  oem_brands: {
                    type: "array",
                    items: { type: "string" },
                    description: "Car brands/makes sold (e.g. Toyota, Honda, Ford)",
                  },
                  staff_emails: {
                    type: "array",
                    items: { type: "string" },
                    description: "All staff/department email addresses found (e.g. internet@dealer.com, service@dealer.com, gm@dealer.com)",
                  },
                  staff_phones: {
                    type: "array",
                    items: { type: "string" },
                    description: "All staff/department phone numbers found",
                  },
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
                        website_url: { type: "string", description: "Location-specific website URL if different from corporate" },
                      },
                    },
                    description: "Individual store locations with full details",
                  },
                  business_hours: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        department: { type: "string", description: "Sales, Service, Parts, or General" },
                        days: { type: "string", description: "e.g. Mon-Fri" },
                        hours: { type: "string", description: "e.g. 9:00 AM - 7:00 PM" },
                      },
                    },
                    description: "Business hours by department — extract Sales AND Service hours separately when available",
                  },
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
                    description: "Staff/team members found with their roles",
                  },
                  dealer_group_name: { type: "string", description: "Parent dealer group name if part of a group" },
                  dms_provider: { type: "string", description: "DMS/CRM provider if mentioned (e.g. DealerSocket, CDK, Reynolds)" },
                  stats_years_in_business: { type: "string", description: "Years in business if explicitly stated" },
                  stats_rating: { type: "string", description: "Google/review rating (e.g. 4.8)" },
                  stats_reviews_count: { type: "string", description: "Number of reviews if mentioned (e.g. '2,400+')" },
                  stats_cars_purchased: { type: "string", description: "Number of cars purchased/sold if mentioned (e.g. '14,721+')" },
                  established_year: { type: "string", description: "Year the dealership was established/founded (e.g. '1987'). Check EVERYWHERE: footer copyright, about page, hero, tagline, copyright text. 'Since YYYY', 'Est. YYYY', 'Founded YYYY', 'Family-owned since YYYY', 'Serving since YYYY', 'Proudly serving since YYYY', '[X] years of experience' → compute year." },
                  meta_description: { type: "string", description: "The page meta description" },
                  certifications: {
                    type: "array",
                    items: { type: "string" },
                    description: "Certifications, awards, accreditations (e.g. 'BBB A+', 'Edmunds Five Star', 'Dealer of the Year 2023')",
                  },
                  community_involvement: {
                    type: "string",
                    description: "Any community involvement, sponsorships, charity partnerships mentioned",
                  },
                  service_offerings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Services offered: 'New Cars', 'Used Cars', 'We Buy Cars', 'Trade-In', 'Service', 'Parts', 'Body Shop', 'Financing'",
                  },
                  testimonials: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Customer name" },
                        text: { type: "string", description: "Review/testimonial text" },
                        rating: { type: "number", description: "Star rating 1-5" },
                      },
                    },
                    description: "Up to 5 customer testimonials or review snippets found on the site",
                  },
                  referral_program: { type: "boolean", description: "Whether a referral or refer-a-friend program is mentioned" },
                  price_guarantee_days: { type: "string", description: "If a price guarantee period is mentioned, e.g. '7 days', '10 days'" },
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
    let extracted: Record<string, any> = {};

    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    // Log extraction summary
    const fieldCount = Object.keys(extracted).filter(k => {
      const v = extracted[k];
      return v && (typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length > 0 : true);
    }).length;
    console.log(`Extracted ${fieldCount} fields from ${pagesToScrape.length + 1} pages`);
    console.log("Extracted dealer info:", JSON.stringify(extracted).slice(0, 1000));

    return new Response(
      JSON.stringify({ success: true, data: extracted, pages_scraped: pagesToScrape.length + 1 }),
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
