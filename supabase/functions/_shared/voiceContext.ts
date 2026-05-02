// Shared voice-call context builder.
//
// Pulls every signal the AI agent needs to be useful on a single
// outbound call: who the customer is, what we offered, where the
// negotiation can go (ACV ceiling + authorized bump), what's stalling
// the deal (missing docs / lien payoff), and 3 live appointment
// slots so the agent can schedule on the call instead of bouncing
// to a webform.
//
// Used by:
//   - launch-voice-call (when invoked with an intent like
//     "voice_offer_re_engage" or "voice_schedule_inspection")
//   - the future Bland.ai dynamic-context callback (Bland fetches
//     fresh context per call to handle multi-turn conversation)

export interface VoiceContext {
  customer: {
    name: string;
    first_name: string;
    phone: string | null;
    email: string | null;
    state: string | null;
    timezone: string | null;
  };
  vehicle: {
    year: string | null;
    make: string | null;
    model: string | null;
    mileage: string | null;
    summary: string;
    vin: string | null;
  };
  offer: {
    current_offer: number | null;       // what we last quoted to the customer
    acv_ceiling: number | null;         // internal ceiling, never quote
    authorized_bump_pct: number;        // how much room the AI has without manager approval
    max_quotable: number | null;        // current_offer + bump (what AI can quote)
    headroom: number | null;            // ceiling - max_quotable (visible to AI for transparency)
    expiry: string | null;              // ISO date
    days_until_expiry: number | null;
    accepted_at: string | null;         // ISO date or null
    hours_since_acceptance: number | null;
  };
  state_signals: {
    progress_status: string;
    decline_reason: string | null;
    cadence_state: string | null;
    cadence_step: number;
    has_loan: boolean;
    loan_company: string | null;
    title_uploaded: boolean;            // best-effort — based on docs_uploaded
  };
  scheduling: {
    proposed_slots: Array<{ id: string; iso: string; human: string; location: string | null }>;
    dealer_name: string;
    dealer_phone: string | null;
    appointment_already_booked: boolean;
  };
  intent: string;                       // why we're calling
  prompt_block: string;                 // ready-to-send agent system prompt
}

/**
 * Build the full context payload for an outbound voice call.
 * Caller passes the supabase service-role client + submission_id +
 * intent. Returns null if the submission can't be loaded.
 */
export async function buildVoiceContext(
  supabase: any,
  submissionId: string,
  intent: string,
): Promise<VoiceContext | null> {
  const { data: sub } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub) return null;

  const { data: site } = await supabase
    .from("site_config")
    .select("dealership_name, phone, price_guarantee_days")
    .eq("dealership_id", sub.dealership_id)
    .maybeSingle();

  const { data: notif } = await supabase
    .from("notification_settings")
    .select("cadence_authorized_bump_pct")
    .eq("dealership_id", sub.dealership_id)
    .maybeSingle();

  const bumpPct = Number((notif as any)?.cadence_authorized_bump_pct) || 5;
  const currentOffer = sub.offered_price ?? sub.estimated_offer_high ?? null;
  const acvCeiling = sub.acv_value ?? null;
  const maxQuotable = currentOffer != null
    ? Math.min(
        Math.floor(currentOffer * (1 + bumpPct / 100)),
        acvCeiling ?? Number.POSITIVE_INFINITY,
      )
    : null;
  const headroom = (acvCeiling != null && maxQuotable != null) ? acvCeiling - maxQuotable : null;

  const now = new Date();
  const guaranteeDays = Number((site as any)?.price_guarantee_days) || 7;
  const acceptedAt = sub.progress_status === "accepted" ? sub.status_updated_at : null;
  const expiry = acceptedAt
    ? new Date(new Date(acceptedAt).getTime() + guaranteeDays * 24 * 60 * 60_000).toISOString()
    : null;
  const daysUntilExpiry = expiry
    ? Math.ceil((new Date(expiry).getTime() - now.getTime()) / (24 * 60 * 60_000))
    : null;
  const hoursSinceAcceptance = acceptedAt
    ? Math.floor((now.getTime() - new Date(acceptedAt).getTime()) / (60 * 60_000))
    : null;

  // Fetch 3 next available appointment slots for the lead's location.
  // Falls back to "any slot in the next 7 days" if we don't have a
  // calendar integration. The agent uses these to book on-call.
  const proposedSlots = await proposeSlots(supabase, sub);

  // Check if appointment already exists.
  const { data: existingAppt } = await supabase
    .from("appointments")
    .select("id")
    .eq("submission_id", sub.id)
    .in("status", ["scheduled", "confirmed"])
    .limit(1);
  const appointmentAlreadyBooked = (existingAppt?.length ?? 0) > 0;

  const firstName = (sub.name || "").split(" ")[0] || "there";
  const vehicleSummary = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ") || "your vehicle";
  const dealerName = (site as any)?.dealership_name || "the dealership";

  const promptBlock = buildPromptForIntent(intent, {
    firstName,
    vehicleSummary,
    currentOffer,
    maxQuotable,
    bumpPct,
    expiry,
    daysUntilExpiry,
    hoursSinceAcceptance,
    declineReason: sub.decline_reason,
    hasLoan: !!sub.loan_status && String(sub.loan_status).toLowerCase() !== "none",
    loanCompany: sub.loan_company,
    proposedSlots,
    dealerName,
  });

  return {
    customer: {
      name: sub.name || "",
      first_name: firstName,
      phone: sub.phone,
      email: sub.email,
      state: sub.state,
      timezone: sub.customer_timezone,
    },
    vehicle: {
      year: sub.vehicle_year,
      make: sub.vehicle_make,
      model: sub.vehicle_model,
      mileage: sub.mileage,
      summary: vehicleSummary,
      vin: sub.vin,
    },
    offer: {
      current_offer: currentOffer,
      acv_ceiling: acvCeiling,
      authorized_bump_pct: bumpPct,
      max_quotable: maxQuotable,
      headroom,
      expiry,
      days_until_expiry: daysUntilExpiry,
      accepted_at: acceptedAt,
      hours_since_acceptance: hoursSinceAcceptance,
    },
    state_signals: {
      progress_status: sub.progress_status || "",
      decline_reason: sub.decline_reason || null,
      cadence_state: sub.cadence_state || null,
      cadence_step: sub.cadence_step ?? 0,
      has_loan: !!sub.loan_status && String(sub.loan_status).toLowerCase() !== "none",
      loan_company: sub.loan_company || null,
      title_uploaded: !!sub.docs_uploaded,
    },
    scheduling: {
      proposed_slots: proposedSlots,
      dealer_name: dealerName,
      dealer_phone: (site as any)?.phone || null,
      appointment_already_booked: appointmentAlreadyBooked,
    },
    intent,
    prompt_block: promptBlock,
  };
}

async function proposeSlots(supabase: any, sub: any): Promise<VoiceContext["scheduling"]["proposed_slots"]> {
  // V1 — generate three forward-looking slots: tomorrow 10am, tomorrow
  // 2pm, day-after-tomorrow 10am, all in customer-local time. Once we
  // wire up the dealer's actual calendar (Calendly / Google / a
  // dedicated availability table), this gets replaced. For now this
  // gives the AI three concrete options to read aloud.
  const tz = sub.customer_timezone || "America/New_York";
  const slots: VoiceContext["scheduling"]["proposed_slots"] = [];
  const baseTimes = [
    { dayOffset: 1, hour: 10 },
    { dayOffset: 1, hour: 14 },
    { dayOffset: 2, hour: 10 },
  ];

  // Resolve dealer location label (best-effort).
  let location: string | null = null;
  if (sub.store_location_id) {
    const { data: loc } = await supabase
      .from("store_locations")
      .select("name, city, state")
      .eq("id", sub.store_location_id)
      .maybeSingle();
    if (loc) location = `${(loc as any).name || ""}${(loc as any).city ? `, ${(loc as any).city}` : ""}`.trim();
  }

  for (const t of baseTimes) {
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + t.dayOffset);
    target.setUTCHours(t.hour + 5, 0, 0, 0); // crude — assumes ET; real impl uses tz library
    const human = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(target);
    slots.push({
      id: `proposed_${target.getTime()}`,
      iso: target.toISOString(),
      human,
      location,
    });
  }
  return slots;
}

function buildPromptForIntent(intent: string, vars: {
  firstName: string;
  vehicleSummary: string;
  currentOffer: number | null;
  maxQuotable: number | null;
  bumpPct: number;
  expiry: string | null;
  daysUntilExpiry: number | null;
  hoursSinceAcceptance: number | null;
  declineReason: string | null;
  hasLoan: boolean;
  loanCompany: string | null;
  proposedSlots: VoiceContext["scheduling"]["proposed_slots"];
  dealerName: string;
}): string {
  const offerStr = vars.currentOffer != null ? `$${Math.round(vars.currentOffer).toLocaleString()}` : "your offer";
  const maxStr = vars.maxQuotable != null ? `$${Math.round(vars.maxQuotable).toLocaleString()}` : "your offer";
  const slotsStr = vars.proposedSlots.map((s, i) => `(${i + 1}) ${s.human}`).join(", ");

  const COMMON_RULES = `
RULES:
- Speak naturally, conversationally. Under 150 wpm. Sub-second replies.
- Skip "How are you today" — get to the point in the first sentence.
- If they want to talk to a person, transfer immediately.
- If they ask a question you don't know, say "I'll have the team text you within an hour."
- Confirm consent before sending any SMS at the end of the call.
- TCPA compliance: do not call back if they say "stop calling" — set the cadence_paused flag.`;

  const REENGAGE = `
You are calling ${vars.firstName} on behalf of ${vars.dealerName}.
You are following up on the cash offer of ${offerStr} for their ${vars.vehicleSummary}.
You are AUTHORIZED to refresh the number up to ${maxStr} (this is a ${vars.bumpPct}% manager-approved bump). Do not quote higher than that — instead say "let me check with my manager and call you right back."
${vars.declineReason === "price_too_low" ? "They previously told us the price was too low — lead with the bump immediately." : ""}
${vars.declineReason === "shopping_around" ? "They previously told us they're shopping around — ask what their best competing quote is, and offer to match or beat." : ""}
${vars.declineReason === "not_ready" ? "They previously told us they're not ready yet — keep this brief, no pressure, just check in and confirm if there's a better month for them." : ""}

OPENER (use this verbatim, but inject their name):
"Hi ${vars.firstName}, this is Sam from ${vars.dealerName}. Quick call — my used-car manager pulled comps this morning on your ${vars.vehicleSummary} and we may have room to come up. Got 60 seconds?"
${COMMON_RULES}`;

  const SCHEDULE = `
You are calling ${vars.firstName} on behalf of ${vars.dealerName}.
They accepted our cash offer of ${offerStr} on their ${vars.vehicleSummary} ${vars.hoursSinceAcceptance != null ? `${vars.hoursSinceAcceptance} hours ago` : "recently"} but haven't scheduled the inspection yet. Your job is to get them scheduled on this call.
Their offer is locked through ${vars.expiry ? new Date(vars.expiry).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "the next few days"} (${vars.daysUntilExpiry ?? "a few"} days from now).
Available slots to offer (read these as options 1, 2, or 3): ${slotsStr || "any slot in the next few days"}.
${vars.hasLoan ? `They still have a loan with ${vars.loanCompany || "their lender"}. The 10-day payoff letter takes a few days, so flag this — we can request it on their behalf with a signed authorization.` : ""}

OPENER (use this verbatim, but inject their name):
"Hi ${vars.firstName}, this is Sarah from ${vars.dealerName} — I'm calling about the ${offerStr} offer you accepted on your ${vars.vehicleSummary}. We're holding it for you through ${vars.expiry ? new Date(vars.expiry).toLocaleDateString("en-US", { weekday: "short" }) : "this week"}. Got 60 seconds to lock a time?"

If they say "I need to think about it": acknowledge, then ask ONE diagnostic — "Is it the price, the timing, or something about the docs?" — and resolve that specific thing.
${COMMON_RULES}`;

  switch (intent) {
    case "voice_offer_re_engage":
    case "voice_offer_refresh":
      return REENGAGE;
    case "voice_schedule_inspection":
      return SCHEDULE;
    default:
      return REENGAGE;
  }
}
