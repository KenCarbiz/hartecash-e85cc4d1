import { supabase } from "@/integrations/supabase/client";

type Answers = Record<string, string>;

/**
 * Hex to HSL conversion for color fields.
 * Returns "H S% L%" format used by tailwind config.
 */
function hexToHsl(hex: string): string | null {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function yn(val: string | undefined): boolean {
  return val?.toLowerCase() === "yes";
}

function channelsFromAnswer(val: string | undefined): string[] {
  if (!val) return [];
  if (val === "Email") return ["email"];
  if (val === "SMS") return ["sms"];
  if (val === "Both") return ["email", "sms"];
  return [];
}

/**
 * Applies all onboarding questionnaire answers to their respective config tables.
 * Returns a summary of what was written.
 */
export async function applyOnboardingAnswers(
  answers: Answers,
  dealershipId: string
): Promise<{ applied: string[]; errors: string[] }> {
  const applied: string[] = [];
  const errors: string[] = [];

  // ── 1. Site Config ──
  try {
    const siteUpdates: Record<string, any> = {};
    if (answers.dealership_name) siteUpdates.dealership_name = answers.dealership_name;
    if (answers.tagline) siteUpdates.tagline = answers.tagline;
    if (answers.phone) siteUpdates.phone = answers.phone;
    if (answers.email) siteUpdates.email = answers.email;
    if (answers.address) siteUpdates.address = answers.address;
    if (answers.website) siteUpdates.website_url = answers.website;
    if (answers.google_review) siteUpdates.google_review_url = answers.google_review;
    if (answers.facebook) siteUpdates.facebook_url = answers.facebook;
    if (answers.instagram) siteUpdates.instagram_url = answers.instagram;
    if (answers.tiktok) siteUpdates.tiktok_url = answers.tiktok;
    if (answers.youtube) siteUpdates.youtube_url = answers.youtube;
    if (answers.hero_headline) siteUpdates.hero_headline = answers.hero_headline;
    if (answers.hero_subtext) siteUpdates.hero_subtext = answers.hero_subtext;
    if (answers.guarantee_days) siteUpdates.price_guarantee_days = parseInt(answers.guarantee_days) || 8;
    if (answers.enable_animations) siteUpdates.enable_animations = yn(answers.enable_animations);
    if (answers.animated_calc) siteUpdates.use_animated_calculating = yn(answers.animated_calc);
    if (answers.image_angle) {
      siteUpdates.vehicle_image_angle = answers.image_angle === "Side Profile" ? "side" : "three_quarter";
    }
    if (answers.overlay_color) {
      const colorMap: Record<string, string> = { Green: "#00FF88", Red: "#FF4444", White: "#FFFFFF" };
      siteUpdates.photo_overlay_color = colorMap[answers.overlay_color] || "#00FF88";
    }
    if (answers.allow_color_change) siteUpdates.photo_allow_color_change = yn(answers.allow_color_change);

    // Hero layout
    if (answers.hero_layout) {
      const layoutMap: Record<string, string> = { "Offset Right": "offset_right", "Offset Left": "offset_left", Stacked: "stacked" };
      siteUpdates.hero_layout = layoutMap[answers.hero_layout] || "offset_right";
    }

    // Colors (hex → HSL)
    if (answers.primary_color?.startsWith("#")) {
      const hsl = hexToHsl(answers.primary_color);
      if (hsl) siteUpdates.primary_color = hsl;
    }
    if (answers.accent_color?.startsWith("#")) {
      const hsl = hexToHsl(answers.accent_color);
      if (hsl) siteUpdates.accent_color = hsl;
    }
    if (answers.success_color?.startsWith("#")) {
      const hsl = hexToHsl(answers.success_color);
      if (hsl) siteUpdates.success_color = hsl;
    }

    // Routing
    if (answers.assign_zip) siteUpdates.assign_auto_zip = yn(answers.assign_zip);
    if (answers.assign_oem) siteUpdates.assign_oem_brand_match = yn(answers.assign_oem);
    if (answers.customer_picks) siteUpdates.assign_customer_picks = yn(answers.customer_picks);
    if (answers.buying_center) siteUpdates.assign_buying_center = yn(answers.buying_center);

    if (Object.keys(siteUpdates).length > 0) {
      // Upsert
      const { error } = await supabase
        .from("site_config")
        .upsert({ dealership_id: dealershipId, ...siteUpdates }, { onConflict: "dealership_id" });
      if (error) throw error;
      applied.push(`Site Config (${Object.keys(siteUpdates).length} fields)`);
    }
  } catch (e: any) {
    errors.push(`Site Config: ${e.message}`);
  }

  // ── 2. Form Config ──
  try {
    const formUpdates: Record<string, any> = {};
    if (answers.step_vehicle_build) formUpdates.step_vehicle_build = yn(answers.step_vehicle_build);
    if (answers.step_condition) formUpdates.step_condition_history = yn(answers.step_condition);
    if (answers.flow_style) formUpdates.offer_before_details = answers.flow_style === "Offer First";
    if (answers.q_loan) formUpdates.q_loan_details = yn(answers.q_loan);
    if (answers.q_next_step) formUpdates.q_next_step = yn(answers.q_next_step);

    if (Object.keys(formUpdates).length > 0) {
      const { error } = await supabase
        .from("form_config" as any)
        .upsert({ dealership_id: dealershipId, ...formUpdates }, { onConflict: "dealership_id" });
      if (error) throw error;
      applied.push(`Form Config (${Object.keys(formUpdates).length} fields)`);
    }
  } catch (e: any) {
    errors.push(`Form Config: ${e.message}`);
  }

  // ── 3. Notification Settings ──
  try {
    const notifUpdates: Record<string, any> = {};
    if (answers.staff_emails) {
      notifUpdates.email_recipients = answers.staff_emails.split("\n").map((e) => e.trim()).filter(Boolean);
    }
    if (answers.staff_sms) {
      notifUpdates.sms_recipients = answers.staff_sms.split("\n").map((p) => p.trim()).filter(Boolean);
    }
    if (answers.notify_submission) {
      notifUpdates.notify_new_submission = answers.notify_submission !== "Off";
      notifUpdates.new_submission_channels = channelsFromAnswer(answers.notify_submission);
    }
    if (answers.notify_hot_lead) {
      notifUpdates.notify_hot_lead = answers.notify_hot_lead !== "Off";
      notifUpdates.hot_lead_channels = channelsFromAnswer(answers.notify_hot_lead);
    }
    if (answers.notify_abandoned) {
      notifUpdates.notify_abandoned_lead = answers.notify_abandoned !== "Off";
      notifUpdates.abandoned_lead_channels = channelsFromAnswer(answers.notify_abandoned);
    }
    if (answers.notify_offer_ready) {
      notifUpdates.notify_customer_offer_ready = answers.notify_offer_ready !== "Off";
      notifUpdates.customer_offer_ready_channels = channelsFromAnswer(answers.notify_offer_ready);
    }
    if (answers.quiet_hours) {
      notifUpdates.quiet_hours_enabled = true;
    }

    if (Object.keys(notifUpdates).length > 0) {
      const { error } = await supabase
        .from("notification_settings" as any)
        .upsert({ dealership_id: dealershipId, ...notifUpdates }, { onConflict: "dealership_id" });
      if (error) throw error;
      applied.push(`Notifications (${Object.keys(notifUpdates).length} fields)`);
    }
  } catch (e: any) {
    errors.push(`Notifications: ${e.message}`);
  }

  // ── 4. Inspection Config ──
  try {
    const inspUpdates: Record<string, any> = {};
    if (answers.show_tire_depth) inspUpdates.show_tire_tread_depth = yn(answers.show_tire_depth);
    if (answers.show_brake_pads) inspUpdates.show_brake_pad_measurements = yn(answers.show_brake_pads);
    if (answers.show_paint) inspUpdates.show_paint_readings = yn(answers.show_paint);
    if (answers.show_oil) inspUpdates.show_oil_life = yn(answers.show_oil);
    if (answers.show_battery) inspUpdates.show_battery_health = yn(answers.show_battery);
    if (answers.tire_adjustments) inspUpdates.enable_tire_adjustments = yn(answers.tire_adjustments);
    if (answers.tire_mode) {
      inspUpdates.tire_adjustment_mode = answers.tire_mode === "Per Tire" ? "per_tire" : "whole";
    }

    if (Object.keys(inspUpdates).length > 0) {
      const { error } = await supabase
        .from("inspection_config" as any)
        .upsert({ dealership_id: dealershipId, ...inspUpdates }, { onConflict: "dealership_id" });
      if (error) throw error;
      applied.push(`Inspection Config (${Object.keys(inspUpdates).length} fields)`);
    }
  } catch (e: any) {
    errors.push(`Inspection Config: ${e.message}`);
  }

  // ── 5. Locations (dynamic parsing) ──
  try {
    if (answers.locations_dynamic?.trim()) {
      const lines = answers.locations_dynamic.split("\n").filter((l) => l.trim());
      let locationsCreated = 0;
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split("|").map((p) => p.trim());
        const name = parts[0];
        if (!name) continue;
        const address = parts[1] || "";
        const csz = parts[2] || "";
        const brands = parts[3] ? parts[3].split(",").map((b) => b.trim()).filter(Boolean) : [];

        // Parse city, state from CSZ
        const cszMatch = csz.match(/^(.+?),\s*([A-Z]{2})\s*(\d{5})?/i);
        const city = cszMatch?.[1] || csz || "Unknown";
        const state = cszMatch?.[2] || "CT";
        const zip = cszMatch?.[3] || "";

        const { error } = await supabase
          .from("dealership_locations")
          .insert({
            dealership_id: dealershipId,
            name,
            address,
            city,
            state: state.toUpperCase(),
            oem_brands: brands,
            all_brands: brands.length === 0,
            center_zip: zip,
            sort_order: i,
            location_type: i === 0 ? "primary" : "sister",
          });
        if (!error) locationsCreated++;
      }
      if (locationsCreated > 0) applied.push(`Locations (${locationsCreated} created)`);
    }
    
    // Also handle legacy loc1/loc2/loc3 format
    for (let i = 1; i <= 3; i++) {
      const name = answers[`loc${i}_name`];
      if (!name?.trim()) continue;
      const address = answers[`loc${i}_address`] || "";
      const csz = answers[`loc${i}_csz`] || "";
      const brands = answers[`loc${i}_brands`]
        ? answers[`loc${i}_brands`].split(",").map((b) => b.trim()).filter(Boolean)
        : [];
      const cszMatch = csz.match(/^(.+?),\s*([A-Z]{2})\s*(\d{5})?/i);
      const city = cszMatch?.[1] || csz || "Unknown";
      const state = cszMatch?.[2] || "CT";

      // Check if location already exists with this name
      const { data: existing } = await supabase
        .from("dealership_locations")
        .select("id")
        .eq("dealership_id", dealershipId)
        .eq("name", name)
        .maybeSingle();
      
      if (!existing) {
        await supabase.from("dealership_locations").insert({
          dealership_id: dealershipId,
          name,
          address,
          city,
          state: state.toUpperCase(),
          oem_brands: brands,
          all_brands: brands.length === 0,
          sort_order: i - 1,
          location_type: i === 1 ? "primary" : "sister",
        });
        applied.push(`Location: ${name}`);
      }
    }
  } catch (e: any) {
    errors.push(`Locations: ${e.message}`);
  }

  return { applied, errors };
}
