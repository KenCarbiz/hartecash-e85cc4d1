/**
 * Single source of truth for onboarding questionnaire sections.
 * Used by both OnboardingScript (admin) and OnboardingMobile (dealer-facing).
 */

export interface QuestionItem {
  id: string;
  label: string;
  type: "text" | "check" | "choice" | "multiline" | "link";
  choices?: string[];
  hint?: string;
  /** For "link" type — the admin sidebar section to navigate to */
  linkTarget?: string;
  /** If true, this question only shows on the admin version, not mobile */
  adminOnly?: boolean;
}

export interface Section {
  title: string;
  icon: string;
  questions: QuestionItem[];
}

export const ONBOARDING_SECTIONS: Section[] = [
  {
    title: "1. Dealership Identity",
    icon: "🏢",
    questions: [
      { id: "dealership_name", label: "Dealership Name", type: "text" },
      { id: "tagline", label: "Tagline / Slogan", type: "text" },
      { id: "phone", label: "Main Phone Number", type: "text" },
      { id: "email", label: "Main Email Address", type: "text" },
      { id: "address", label: "Physical Address", type: "text" },
      { id: "website", label: "Website URL", type: "text" },
      { id: "google_review", label: "Google Review Link", type: "text" },
      { id: "facebook", label: "Facebook URL", type: "text" },
      { id: "instagram", label: "Instagram URL", type: "text" },
      { id: "tiktok", label: "TikTok URL", type: "text" },
      { id: "youtube", label: "YouTube URL", type: "text" },
    ],
  },
  {
    title: "2. Architecture & BDC",
    icon: "🏗️",
    questions: [
      { id: "architecture", label: "Store Architecture", type: "choice", choices: ["Single Store", "Multi-Location", "Dealer Group"] },
      { id: "bdc_model", label: "BDC Model", type: "choice", choices: ["No BDC", "Single BDC", "Multi-Location BDC", "AI BDC"] },
      { id: "num_locations", label: "Number of Locations", type: "text" },
      { id: "billing_start", label: "Billing Start Date", type: "text", adminOnly: true },
      { id: "billing_day", label: "Billing Day of Month (1–31)", type: "text", adminOnly: true },
      { id: "special_instructions", label: "Special Instructions / Notes", type: "multiline" },
    ],
  },
  {
    title: "3. Branding & Colors",
    icon: "🎨",
    questions: [
      { id: "primary_color", label: "Primary Brand Color", type: "text", hint: "Hex code, e.g. #1e3a5f — or describe: 'navy blue'" },
      { id: "accent_color", label: "Accent / Secondary Color", type: "text", hint: "Hex code or color name" },
      { id: "success_color", label: "Success / CTA Color", type: "text", hint: "For buttons and highlights" },
      { id: "logo_provided", label: "Logo file provided?", type: "check" },
      { id: "white_logo_provided", label: "White logo file provided?", type: "check" },
      { id: "favicon_provided", label: "Favicon provided?", type: "check" },
    ],
  },
  {
    title: "4. Hero & Landing Page",
    icon: "📢",
    questions: [
      { id: "hero_headline", label: "Hero Headline", type: "text", hint: 'e.g. "Sell Your Car in 2 Minutes"' },
      { id: "hero_subtext", label: "Hero Sub-text", type: "text" },
      { id: "hero_layout", label: "Hero Layout", type: "choice", choices: ["Offset Right", "Offset Left", "Stacked"] },
      { id: "enable_animations", label: "Enable page animations?", type: "choice", choices: ["Yes", "No"] },
      { id: "animated_calc", label: "Show animated offer calculation?", type: "choice", choices: ["Yes", "No"] },
    ],
  },
  {
    title: "5. Lead Form Flow",
    icon: "📝",
    questions: [
      { id: "flow_style", label: "Flow style", type: "choice", choices: ["Details First", "Offer First"], hint: "When should customer see their offer?" },
      { id: "step_vehicle_build", label: "Include Vehicle Build step?", type: "choice", choices: ["Yes", "No"] },
      { id: "step_condition", label: "Include Condition & History step?", type: "choice", choices: ["Yes", "No"] },
      { id: "guarantee_days", label: "Price Guarantee Days", type: "text", hint: "Default: 8" },
    ],
  },
  {
    title: "6. Form & Condition Questions",
    icon: "🚗",
    questions: [
      {
        id: "form_config_link",
        label: "Vehicle build and condition questions are managed in Form Configuration",
        type: "link",
        linkTarget: "form-config",
        hint: "Click to open Form Configuration where you can toggle individual questions on/off.",
        adminOnly: true,
      },
      { id: "q_loan", label: "Show Loan / Payoff Details?", type: "choice", choices: ["Yes", "No"] },
      { id: "q_next_step", label: "Show Next Step Preference?", type: "choice", choices: ["Yes", "No"] },
    ],
  },
  {
    title: "7. Photo Requirements",
    icon: "📷",
    questions: [
      { id: "overlay_color", label: "GhostCar overlay color", type: "choice", choices: ["Green", "Red", "White"], hint: "The silhouette guide shown during customer photo uploads" },
      { id: "allow_color_change", label: "Allow customer to change overlay color?", type: "choice", choices: ["Yes", "No"] },
      { id: "image_angle", label: "Vehicle display image angle", type: "choice", choices: ["3/4 Front Angle", "Side Profile"], hint: "The hero image on offers and portal — not the upload guide" },
      { id: "required_shots", label: "Required photo shots", type: "multiline", hint: "e.g. Front, Rear, Driver Side, Passenger Side, Dashboard, Odometer, VIN Plate, Engine Bay" },
    ],
  },
  {
    title: "8. Acquisition Strategy",
    icon: "💵",
    questions: [
      { id: "acquisition_intent", label: "How aggressive should offers be?", type: "choice", choices: ["Conservative", "Market", "Competitive", "Aggressive", "Predator"], hint: "Conservative = own it cheap. Market = fair trade value. Competitive = win more deals. Aggressive = top-dollar sight-unseen. Predator = highest offer, adjust at inspection." },
      { id: "pricing_model", label: "Starting Pricing Model", type: "choice", choices: ["Default"], hint: "Additional models can be created in Offer Logic after onboarding." },
      { id: "pricing_notes", label: "Any special pricing instructions?", type: "multiline", hint: "e.g. 'Never go above $30k on trucks' or 'Match Carvana within $200'" },
    ],
  },
  {
    title: "9. Notifications",
    icon: "🔔",
    questions: [
      { id: "staff_emails", label: "Staff Email Recipients", type: "multiline", hint: "One email per line" },
      { id: "staff_sms", label: "Staff SMS Recipients", type: "multiline", hint: "One phone per line" },
      { id: "notify_submission", label: "New Submission alerts", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "notify_hot_lead", label: "Hot Lead alerts", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "notify_abandoned", label: "Abandoned Lead alerts", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "notify_offer_ready", label: "Customer Offer Ready", type: "choice", choices: ["Email", "SMS", "Both", "Off"] },
      { id: "quiet_hours", label: "Quiet Hours", type: "text", hint: "e.g. 9pm – 7am" },
    ],
  },
  {
    title: "10. Inspection Sheet",
    icon: "📋",
    questions: [
      { id: "show_tire_depth", label: "Show tire tread depth?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_brake_pads", label: "Show brake pad measurements?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_paint", label: "Show paint readings?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_oil", label: "Show oil life?", type: "choice", choices: ["Yes", "No"] },
      { id: "show_battery", label: "Show battery health?", type: "choice", choices: ["Yes", "No"] },
      { id: "tire_adjustments", label: "Enable tire adjustments?", type: "choice", choices: ["Yes", "No"] },
      { id: "tire_mode", label: "Tire adjustment mode", type: "choice", choices: ["Whole (average)", "Per Tire"] },
    ],
  },
  {
    title: "11. Locations",
    icon: "📍",
    questions: [
      { id: "locations_dynamic", label: "Location entries", type: "multiline", hint: "One location per line in format: Name | Address | City, State ZIP | OEM Brands\ne.g. Smith Toyota | 123 Main St | Hartford, CT 06103 | Toyota, Lexus" },
    ],
  },
  {
    title: "12. Lead Routing",
    icon: "🔀",
    questions: [
      { id: "assign_zip", label: "Auto-assign by ZIP?", type: "choice", choices: ["Yes", "No"] },
      { id: "assign_oem", label: "Auto-assign by OEM brand?", type: "choice", choices: ["Yes", "No"] },
      { id: "customer_picks", label: "Let customer pick location?", type: "choice", choices: ["Yes", "No"] },
      { id: "buying_center", label: "Use dedicated buying center?", type: "choice", choices: ["Yes", "No"] },
      { id: "buying_center_loc", label: "Buying Center Location", type: "text" },
    ],
  },
  {
    title: "13. Operations & Trust",
    icon: "🕐",
    questions: [
      { id: "established_year", label: "Year Established", type: "text", hint: "e.g. 1946 — used for 'XX years in business' trust badges" },
      { id: "business_hours", label: "Business Hours", type: "multiline", hint: "One line per entry: Days | Hours\ne.g. Mon–Thu | 9 AM – 7 PM\nFri–Sat | 9 AM – 6 PM\nSun | Closed" },
      { id: "stats_cars_purchased", label: "Cars Purchased (override)", type: "text", hint: "e.g. 14,721+ — leave blank to auto-calculate" },
      { id: "stats_rating", label: "Google Rating (override)", type: "text", hint: "e.g. 4.9" },
      { id: "stats_reviews_count", label: "Reviews Count (override)", type: "text", hint: "e.g. 2,400+" },
    ],
  },
  {
    title: "14. Service & Trade Landing Pages",
    icon: "🚘",
    questions: [
      { id: "service_hero_headline", label: "Service Landing Headline", type: "text", hint: "e.g. There's Never Been a Better Time to Upgrade or Sell" },
      { id: "service_hero_subtext", label: "Service Landing Subtext", type: "text" },
      { id: "trade_hero_headline", label: "Trade-In Landing Headline", type: "text", hint: "e.g. Submit Your Trade-In Info" },
      { id: "trade_hero_subtext", label: "Trade-In Landing Subtext", type: "text" },
    ],
  },
  {
    title: "15. About Page",
    icon: "📖",
    questions: [
      { id: "about_hero_headline", label: "About Page Headline", type: "text", hint: "e.g. Our Story" },
      { id: "about_hero_subtext", label: "About Page Subtext", type: "text" },
      { id: "about_story", label: "Dealership Story", type: "multiline", hint: "Tell your dealership's story — history, mission, what makes you different" },
    ],
  },
  {
    title: "16. Feature Toggles",
    icon: "⚙️",
    questions: [
      { id: "enable_dl_ocr", label: "Enable Driver's License scanning?", type: "choice", choices: ["Yes", "No"], hint: "Auto-fill customer info from DL photo" },
      { id: "track_abandoned", label: "Track abandoned leads?", type: "choice", choices: ["Yes", "No"], hint: "Monitor and alert on form drop-offs" },
      { id: "referral_enabled", label: "Enable Referral Program?", type: "choice", choices: ["Yes", "No"] },
    ],
  },
  {
    title: "17. Staff & Roles",
    icon: "👥",
    questions: [
      { id: "admin_users", label: "Admin Users (email)", type: "multiline" },
      { id: "gsm_users", label: "GSM/GM Users (email)", type: "multiline" },
      { id: "ucm_users", label: "Used Car Managers (email)", type: "multiline" },
      { id: "bdc_users", label: "Sales / BDC Users (email)", type: "multiline" },
    ],
  },
  {
    title: "13. Staff & Roles",
    icon: "👥",
    questions: [
      { id: "admin_users", label: "Admin Users (email)", type: "multiline" },
      { id: "gsm_users", label: "GSM/GM Users (email)", type: "multiline" },
      { id: "ucm_users", label: "Used Car Managers (email)", type: "multiline" },
      { id: "bdc_users", label: "Sales / BDC Users (email)", type: "multiline" },
    ],
  },
];

/**
 * Get sections filtered for the mobile (dealer-facing) view.
 * Removes adminOnly questions and link-type questions.
 */
export function getMobileSections(): Section[] {
  return ONBOARDING_SECTIONS.map((s) => ({
    ...s,
    questions: s.questions.filter((q) => !q.adminOnly && q.type !== "link"),
  })).filter((s) => s.questions.length > 0);
}

/**
 * Count filled answers for a section.
 */
export function sectionProgress(section: Section, answers: Record<string, string>): { filled: number; total: number } {
  const countable = section.questions.filter((q) => q.type !== "link");
  const filled = countable.filter((q) => answers[q.id]?.trim()).length;
  return { filled, total: countable.length };
}

/**
 * Smart defaults based on architecture selection.
 * Pre-fills routing answers when architecture is chosen.
 */
export function getSmartDefaults(architecture: string): Record<string, string> {
  switch (architecture) {
    case "Single Store":
      return {
        assign_zip: "No",
        assign_oem: "No",
        customer_picks: "No",
        buying_center: "No",
        num_locations: "1",
      };
    case "Multi-Location":
      return {
        assign_zip: "Yes",
        assign_oem: "No",
        customer_picks: "Yes",
        buying_center: "No",
      };
    case "Dealer Group":
      return {
        assign_zip: "Yes",
        assign_oem: "Yes",
        customer_picks: "Yes",
        buying_center: "No",
      };
    default:
      return {};
  }
}
