import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is platform admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleCheck } = await admin.from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("dealership_id", "default")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Platform admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      dealership_id,
      slug,
      display_name,
      custom_domain,
      plan_tier = "standard",
      architecture = "single_store",
      bdc_model = "no_bdc",
      offer_logic_approver_role = "gsm_gm",
      scraped_data,
    } = body;

    if (!dealership_id || !slug || !display_name) {
      return new Response(JSON.stringify({ error: "dealership_id, slug, and display_name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Input validation. Reject anything that could break URL routing, RLS
    // predicates, or multi-tenant slug uniqueness.
    const ID_RE = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;
    const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
    const RESERVED = new Set(["default", "admin", "api", "www", "app", "public", "auth", "supabase", "system", "root"]);
    const validationError = (msg: string) => new Response(
      JSON.stringify({ error: msg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
    if (typeof dealership_id !== "string" || !ID_RE.test(dealership_id) || RESERVED.has(dealership_id)) {
      return validationError("dealership_id must be 3–64 chars, [a-z0-9_-], and not reserved");
    }
    if (typeof slug !== "string" || !SLUG_RE.test(slug) || RESERVED.has(slug)) {
      return validationError("slug must be 3–64 chars, [a-z0-9-], and not reserved");
    }
    if (typeof display_name !== "string" || display_name.trim().length < 2 || display_name.length > 120) {
      return validationError("display_name must be 2–120 characters");
    }
    if (custom_domain && (typeof custom_domain !== "string" || custom_domain.length > 253 || !/^[a-z0-9.-]+$/i.test(custom_domain))) {
      return validationError("custom_domain is not a valid hostname");
    }

    // Pre-flight check: reject if this dealership_id or slug already exists.
    // Prevents the partial-insert state that occurs when tenants succeeds
    // but a downstream table already has a row for the same dealership_id.
    const { data: existing } = await admin.from("tenants")
      .select("dealership_id")
      .or(`dealership_id.eq.${dealership_id},slug.eq.${slug}`)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: "Tenant with this ID or slug already exists" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit trail: record who onboarded this tenant. Best-effort — the
    // tenant_onboarding_audit table is optional; we swallow any missing-
    // table error so the onboarding itself isn't blocked.
    await admin.from("tenant_onboarding_audit").insert({
      dealership_id,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "onboard_start",
    }).catch((e: unknown) => { console.warn("audit log skipped:", e); });

    const steps: string[] = [];

    // Helper: hex to HSL string
    function hexToHsl(hex: string): string {
      if (!hex || !hex.startsWith("#")) return "";
      const clean = hex.replace("#", "");
      if (clean.length < 6) return "";
      const r = parseInt(clean.slice(0, 2), 16) / 255;
      const g = parseInt(clean.slice(2, 4), 16) / 255;
      const b = parseInt(clean.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    }

    const sd = scraped_data || {};

    // 1. Create tenant
    const { error: tenantErr } = await admin.from("tenants").insert({
      dealership_id,
      slug,
      display_name,
      custom_domain: custom_domain || null,
      is_active: true,
    });
    if (tenantErr) {
      if (tenantErr.code === "23505") {
        return new Response(JSON.stringify({ error: "Tenant with this ID or slug already exists" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw tenantErr;
    }
    steps.push("tenant");

    // 2. Create dealer_account
    await admin.from("dealer_accounts").insert({
      dealership_id,
      plan_tier,
      architecture,
      bdc_model,
      offer_logic_approver_role,
      onboarding_status: "active",
      start_date: new Date().toISOString().split("T")[0],
    });
    steps.push("dealer_account");

    // 3. Create site_config — map EVERY available scraped field
    const siteConfig: Record<string, any> = {
      dealership_id,
      dealership_name: sd.dealership_name || display_name,
      tagline: sd.tagline || "Sell Your Car The Easy Way",
      phone: sd.phone || "",
      email: sd.email || "",
      address: sd.address || "",
      website_url: sd.website || "",
      logo_url: sd.logo_url || "",
      logo_white_url: sd.logo_white_url || "",
      hero_headline: sd.hero_headline || "Sell Your Car The Easy Way",
      hero_subtext: sd.hero_subtext || "Get a top-dollar cash offer in 2 minutes. No haggling, no stress.",
    };

    // Colors (hex → HSL)
    if (sd.primary_color) {
      const hsl = hexToHsl(sd.primary_color);
      if (hsl) siteConfig.primary_color = hsl;
    }
    if (sd.accent_color) {
      const hsl = hexToHsl(sd.accent_color);
      if (hsl) siteConfig.accent_color = hsl;
    }
    if (sd.success_color) {
      const hsl = hexToHsl(sd.success_color);
      if (hsl) siteConfig.success_color = hsl;
    }

    // Favicon
    if (sd.favicon_url) siteConfig.favicon_url = sd.favicon_url;

    // Social links
    if (sd.google_review) siteConfig.google_review_url = sd.google_review;
    if (sd.facebook) siteConfig.facebook_url = sd.facebook;
    if (sd.instagram) siteConfig.instagram_url = sd.instagram;
    if (sd.tiktok) siteConfig.tiktok_url = sd.tiktok;
    if (sd.youtube) siteConfig.youtube_url = sd.youtube;

    // About page
    if (sd.about_story) siteConfig.about_story = sd.about_story;
    if (sd.about_hero_headline) siteConfig.about_hero_headline = sd.about_hero_headline;
    if (sd.about_hero_subtext) siteConfig.about_hero_subtext = sd.about_hero_subtext;
    if (sd.about_milestones?.length) siteConfig.about_milestones = sd.about_milestones;
    if (sd.about_values_list?.length) {
      siteConfig.about_values = sd.about_values_list.map((v: string) => ({
        title: v,
        description: "",
      }));
    }

    // Service & Trade landing pages
    if (sd.service_hero_headline) siteConfig.service_hero_headline = sd.service_hero_headline;
    if (sd.service_hero_subtext) siteConfig.service_hero_subtext = sd.service_hero_subtext;
    if (sd.trade_hero_headline) siteConfig.trade_hero_headline = sd.trade_hero_headline;
    if (sd.trade_hero_subtext) siteConfig.trade_hero_subtext = sd.trade_hero_subtext;

    // Trust stats
    if (sd.stats_rating) siteConfig.stats_rating = sd.stats_rating;
    if (sd.stats_reviews_count) siteConfig.stats_reviews_count = sd.stats_reviews_count;
    if (sd.stats_cars_purchased) siteConfig.stats_cars_purchased = sd.stats_cars_purchased;

    // Established year → stats_years_in_business + established_year
    if (sd.established_year) {
      const year = parseInt(sd.established_year);
      if (year > 1800 && year <= new Date().getFullYear()) {
        siteConfig.established_year = year;
        siteConfig.stats_years_in_business = `${new Date().getFullYear() - year}+ yrs`;
      }
    }

    // Business hours
    if (sd.business_hours?.length) {
      const salesHours = sd.business_hours
        .filter((h: any) => !h.department || h.department === "Sales" || h.department === "General")
        .map((h: any) => ({ days: h.days, hours: h.hours }));
      if (salesHours.length) siteConfig.business_hours = salesHours;
    }

    // Price guarantee days
    if (sd.price_guarantee_days) {
      const match = sd.price_guarantee_days.match(/(\d+)/);
      if (match) siteConfig.price_guarantee_days = parseInt(match[1]);
    }

    // Referral program
    if (sd.referral_program === true) {
      siteConfig.referral_program_enabled = true;
    }

    await admin.from("site_config").insert(siteConfig);
    steps.push(`site_config (${Object.keys(siteConfig).length} fields)`);

    // 4. Create form_config (defaults)
    await admin.from("form_config").insert({ dealership_id });
    steps.push("form_config");

    // 5. Create offer_settings (defaults)
    await admin.from("offer_settings").insert({ dealership_id });
    steps.push("offer_settings");

    // 6. Create notification_settings — map scraped staff emails & phones
    const notifInsert: Record<string, any> = { dealership_id };
    if (sd.staff_emails?.length) {
      notifInsert.email_recipients = sd.staff_emails.slice(0, 10);
    }
    if (sd.staff_phones?.length) {
      notifInsert.sms_recipients = sd.staff_phones.slice(0, 10);
    }
    await admin.from("notification_settings").insert(notifInsert);
    steps.push("notification_settings");

    // 7. Create inspection_config (defaults)
    await admin.from("inspection_config").insert({ dealership_id });
    steps.push("inspection_config");

    // 8. Seed photo_config from default template
    const defaultPhotos = [
      { shot_id: "front", label: "Front", description: "Center front bumper, capture full width", orientation: "landscape", is_required: true, sort_order: 0 },
      { shot_id: "rear", label: "Rear", description: "Center rear bumper, capture full width", orientation: "landscape", is_required: true, sort_order: 1 },
      { shot_id: "driver_side", label: "Driver Side", description: "Step back — full bumper to bumper, wheels in frame", orientation: "landscape", is_required: true, sort_order: 2 },
      { shot_id: "passenger_side", label: "Passenger Side", description: "Step back — full bumper to bumper, wheels in frame", orientation: "landscape", is_required: true, sort_order: 3 },
      { shot_id: "dashboard", label: "Dashboard & Odometer", description: "Capture full dash — odometer reading must be visible", orientation: "landscape", is_required: true, sort_order: 4 },
      { shot_id: "interior", label: "Interior", description: "Front seats, console, and steering wheel", orientation: "landscape", is_required: true, sort_order: 5 },
      { shot_id: "driver_rocker", label: "Driver Rocker Panel", description: "Crouch low — shoot along underside between wheels", orientation: "landscape", is_required: false, sort_order: 6 },
      { shot_id: "pass_rocker", label: "Passenger Rocker Panel", description: "Crouch low — shoot along underside between wheels", orientation: "landscape", is_required: false, sort_order: 7 },
      { shot_id: "wheel", label: "Wheel / Tire", description: "Fill the frame with one wheel — check tread depth", orientation: "any", is_required: false, sort_order: 8 },
      { shot_id: "windshield", label: "Windshield", description: "Stand at front corner — capture full glass, look for chips", orientation: "landscape", is_required: false, sort_order: 9 },
      { shot_id: "hood", label: "Engine Bay", description: "Open hood — capture full engine compartment", orientation: "landscape", is_required: false, sort_order: 10 },
      { shot_id: "trunk", label: "Trunk / Cargo Area", description: "Open trunk/liftgate — shoot straight in from behind", orientation: "landscape", is_required: false, sort_order: 11 },
    ];
    await admin.from("photo_config").insert(
      defaultPhotos.map(p => ({ ...p, dealership_id }))
    );
    steps.push("photo_config");

    // 9. Seed dealership locations — from wizard body or scraped data
    const bodyLocations = body.locations;
    if (bodyLocations?.length) {
      const locs = bodyLocations.map((loc: any, i: number) => ({
        dealership_id,
        name: loc.name || display_name,
        city: loc.city || "Unknown",
        state: loc.state || "CT",
        address: loc.address || "",
        phone: loc.phone || sd.phone || "",
        email: loc.email || "",
        sort_order: i,
        location_type: loc.location_type || (i === 0 ? "primary" : "sister_store"),
        oem_brands: loc.oem_brands || [],
        all_brands: !loc.oem_brands?.length,
        corporate_logo_url: loc.corporate_logo_url || null,
        corporate_logo_dark_url: loc.corporate_logo_dark_url || null,
        logo_url: loc.logo_url || null,
        logo_white_url: loc.logo_white_url || null,
        oem_logo_urls: loc.oem_logo_urls || [],
        established_year: sd.established_year ? parseInt(sd.established_year) : null,
        website_url: loc.website_url || null,
      }));
      await admin.from("dealership_locations").insert(locs);
      steps.push(`locations (${locs.length})`);
    } else if (sd.locations?.length) {
      const locs = sd.locations.map((loc: any, i: number) => {
        const parts = (loc.city_state_zip || "").split(",").map((s: string) => s.trim());
        return {
          dealership_id,
          name: loc.name || display_name,
          city: parts[0] || "Unknown",
          state: parts[1]?.split(" ")[0] || "CT",
          address: loc.address || "",
          phone: loc.phone || "",
          email: loc.email || "",
          sort_order: i,
          location_type: i === 0 ? "primary" : "sister_store",
          oem_brands: loc.brands ? loc.brands.split(",").map((b: string) => b.trim()) : [],
          established_year: sd.established_year ? parseInt(sd.established_year) : null,
          website_url: loc.website_url || null,
        };
      });
      await admin.from("dealership_locations").insert(locs);
      steps.push(`locations (${locs.length} from scrape)`);
    } else {
      await admin.from("dealership_locations").insert({
        dealership_id,
        name: display_name,
        city: "Unknown",
        state: "CT",
        address: sd.address || "",
        phone: sd.phone || "",
        email: sd.email || "",
        location_type: "primary",
        established_year: sd.established_year ? parseInt(sd.established_year) : null,
      });
      steps.push("locations (1 default)");
    }

    // 10. Seed testimonials if scraped
    if (sd.testimonials?.length) {
      const testimonials = sd.testimonials.slice(0, 5).map((t: any, i: number) => ({
        dealership_id,
        customer_name: t.name || "Customer",
        text: t.text || "",
        rating: t.rating || 5,
        sort_order: i,
        is_active: true,
      }));
      // Only insert if testimonials table exists (ignore errors)
      await admin.from("testimonials").insert(testimonials).catch(() => {});
    }

    // 11. Seed notification templates
    const triggerTemplates = [
      { trigger_key: "new_submission", channel: "email", subject: "New Vehicle Submission", body: "New submission from {{customer_name}} for their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}." },
      { trigger_key: "new_submission", channel: "sms", subject: null, body: "New lead: {{customer_name}} — {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}" },
      { trigger_key: "hot_lead", channel: "email", subject: "🔥 Hot Lead Alert", body: "{{customer_name}} is ready to sell their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}} and wants to {{next_step}}." },
      { trigger_key: "hot_lead", channel: "sms", subject: null, body: "🔥 Hot Lead: {{customer_name}} — {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}, wants to {{next_step}}" },
      { trigger_key: "photos_uploaded", channel: "email", subject: "Photos Uploaded", body: "{{customer_name}} uploaded photos for their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}." },
      { trigger_key: "docs_uploaded", channel: "email", subject: "Documents Uploaded", body: "{{customer_name}} uploaded documents for their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}." },
      { trigger_key: "appointment_booked", channel: "email", subject: "Appointment Booked", body: "{{customer_name}} booked an appointment for {{preferred_date}} at {{preferred_time}}." },
      { trigger_key: "appointment_booked", channel: "sms", subject: null, body: "Appt booked: {{customer_name}} — {{preferred_date}} at {{preferred_time}}" },
      { trigger_key: "abandoned_lead", channel: "email", subject: "Follow Up: Incomplete Submission", body: "Hi {{customer_name}}, you started getting an offer for your {{vehicle_year}} {{vehicle_make}} {{vehicle_model}} but didn't finish. Tap below to pick up where you left off." },
      { trigger_key: "abandoned_lead", channel: "sms", subject: null, body: "Hi {{customer_name}}, finish your offer for your {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}: {{portal_link}}" },
      { trigger_key: "offer_ready", channel: "email", subject: "Your Cash Offer is Ready!", body: "Great news, {{customer_name}}! Your cash offer for your {{vehicle_year}} {{vehicle_make}} {{vehicle_model}} is ready. View it here: {{portal_link}}" },
      { trigger_key: "offer_accepted", channel: "email", subject: "Offer Accepted! 🎉", body: "{{customer_name}} accepted the offer for their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}." },
      { trigger_key: "offer_increased", channel: "email", subject: "Your Offer Has Been Increased!", body: "{{customer_name}}, we've increased the offer on your {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}. Check your updated offer: {{portal_link}}" },
      { trigger_key: "staff_customer_accepted", channel: "email", subject: "Customer Accepted Offer", body: "{{customer_name}} accepted the offer on their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}. Time to schedule pickup!" },
    ];

    await admin.from("notification_templates").insert(
      triggerTemplates.map(t => ({ ...t, dealership_id }))
    );
    steps.push("notification_templates");

    return new Response(
      JSON.stringify({ success: true, dealership_id, steps }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("onboard-tenant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
