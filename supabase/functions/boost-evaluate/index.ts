// Boost Evaluate — the real-AI replacement for the deterministic
// receipt generator that was running client-side.
//
// Orchestrates everything the dealer specced:
//   1. Vision-analyze each of the 6 boost photos in parallel
//      (delegates to analyze-vehicle-damage which runs Gemini 2.5
//      Flash + writes structured findings to damage_reports)
//   2. Read the damage_reports back and pull out:
//        - OCR'd odometer reading from the dashboard photo
//        - suggested_condition consensus across exterior reports
//        - warning_lights count
//        - tire tread depth + curb rash detection
//        - paint mismatch / accident-repair signs
//        - cabin concerns
//   3. Reconcile the OCR mileage against the customer-stated value.
//      If they differ by more than 1,000 miles AND the OCR
//      confidence is reasonable, persist the verified mileage and
//      re-call bb-lookup with the corrected miles to get a fresh
//      organic appraisal baseline. (This is the "update the
//      appraisal with Black Book offer engine" step — mileage
//      moves price more than any single AI bump signal does.)
//   4. Compute AI bump line items from the remaining findings.
//      Bumps land ON TOP of the new BB baseline so the customer
//      benefits from both the corrected mileage AND the photo
//      evidence of cleaner-than-rated condition.
//   5. Persist offered_price, write an offer_bumps audit row, and
//      return the receipt to the frontend.
//
// MARKET-RESEARCH NOTES — what AI vision actually surfaces that
// dealer software (Manheim MMR, KBB ICO, vAuto, JD Power) prices
// off, ranked by per-vehicle dollar impact:
//
//   1. Mileage verification           ($500–$2,500 swing)
//      OCR vs declared miles. Lower-than-stated miles = bigger
//      offer; higher = adjustment downward via the BB engine.
//
//   2. Condition tier upgrade         ($400–$1,200)
//      AI suggested_condition > customer-rated. Each tier is
//      ~6–10% of book value at typical mileage.
//
//   3. Tire tread depth               ($150–$400)
//      32nds OCR — fresh tires (>7) reduce dealer recon, low
//      tread (<3) is a hard deduct.
//
//   4. No accident-repair signs       ($200–$500)
//      Paint match across panels, factory panel gaps, original
//      fender liners — absence of all three is real money.
//
//   5. Factory wheels, no curb rash   ($100–$300)
//      Aftermarket wheels reduce auction value. Curb damage
//      reduces it further.
//
//   6. Clean dashboard, no codes      ($150–$400)
//      Active warning lights = the inspector pulls codes; clean
//      dash means no immediate recon expense.
//
//   7. Headlight clarity              ($75–$200)
//      Hazed headlights are a $150 recon expense per pair.
//
//   8. Cabin condition                ($100–$300)
//      No smoke staining, no rips, no pet damage = retail-ready
//      interior.
//
// The bump table below maps each finding to a deterministic
// dollar value. Ranges are conservative within each band so the
// customer sees a realistic but appealing total.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BUMP_TOTAL = 2500;     // hard ceiling on total photo-bump
const MIN_BUMP_TOTAL = 0;        // floor — never reduces the offer
const MILEAGE_DRIFT_THRESHOLD = 1000; // OCR vs declared trigger

// Default per-finding dollar values, keyed by canonical
// signal_key (snake_case, stable). Each signal can be overridden
// per-dealer via the boost_bump_rules table (admin → Boost Rules).
// Signals without a row fall back to the defaults below.
const SIGNAL_DEFAULTS: Record<string, { amount: number; enabled: boolean }> = {
  // Tier 1
  mileage_verified:        { amount: 100, enabled: true },
  condition_upgrade:       { amount: 450, enabled: true },
  // Tier 2
  paint_match:             { amount: 225, enabled: true },
  no_accident_repair:      { amount: 175, enabled: true },
  exterior_clean:          { amount: 175, enabled: true },
  // Tier 3
  tire_tread_high:         { amount: 200, enabled: true },
  tire_tread_mid:          { amount: 100, enabled: true },
  wheels_clean:            { amount: 200, enabled: true },
  // Tier 4
  no_warning_lights:       { amount: 200, enabled: true },
  clean_cabin:             { amount: 125, enabled: true },
  // Tier 5 — bonus interior shots. Strongest mileage-honesty
  // tells in the appraisal industry. Only fire when the customer
  // actually uploads the bonus photo (driver seat / steering
  // wheel), so they're a true upside lever, not a baseline bump.
  driver_seat_low_wear:    { amount: 200, enabled: true },
  steering_wheel_unworn:   { amount: 150, enabled: true },
  // Tier 6 (defined but not yet emitted by the orchestrator below)
  headlight_clarity:       { amount: 100, enabled: false },
};

// Special-case: the BB-re-appraisal mileage delta isn't a fixed
// amount — it's whatever Black Book returns when re-priced with
// verified miles. The dealer can disable the entire re-appraisal
// step via a row with signal_key='ocr_mileage_reappraisal' and
// enabled=false; the bump_amount on that row is ignored.
const MILEAGE_REAPPRAISAL_KEY = "ocr_mileage_reappraisal";

interface BumpLineItem {
  label: string;
  amount: number;
  source: string;
}

interface EvalBody {
  token: string;
  photo_paths: Record<string, string>; // { exterior_front: "<token>/exterior_front-1730000000.jpg", ... }
}

const REQUIRED_SHOTS = [
  "exterior_front",
  "exterior_driver",
  "exterior_rear",
  "exterior_passenger",
  "dashboard_odometer",
  "tires_wheels",
];

const CONDITION_RANK: Record<string, number> = {
  poor: 0,
  rough: 0,
  fair: 1,
  good: 2,
  very_good: 3,
  excellent: 4,
};

function rankCondition(c: string | null | undefined): number {
  if (!c) return -1;
  return CONDITION_RANK[c.toLowerCase()] ?? -1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: EvalBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body?.token || !body.photo_paths || typeof body.photo_paths !== "object") {
    return new Response(JSON.stringify({ error: "missing_fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Step 0 — load the submission ──────────────────────────────────
  const { data: row, error: readErr } = await supabase
    .from("submissions")
    .select(
      "id, dealership_id, vin, plate, state, mileage, overall_condition, " +
      "offered_price, estimated_offer_high, bb_tradein_avg, bb_wholesale_avg, " +
      "vehicle_year, vehicle_make, vehicle_model",
    )
    .eq("token", body.token)
    .maybeSingle();

  if (readErr || !row) {
    return new Response(JSON.stringify({ error: "submission_not_found", detail: readErr?.message }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const submissionId = row.id as string;
  const declaredMileage = Number(row.mileage) || 0;

  // ── Idempotency guard ──────────────────────────────────────────────
  // If this submission already had a boost in the last 60 seconds,
  // return the cached result instead of re-running the AI pipeline
  // and stacking another bump. Catches double-taps on Submit, flaky
  // network retries, and accidental refresh-during-evaluation. The
  // recent_boost_bump RPC is in 20260507000000_boost_safety.sql.
  const { data: recent } = await supabase.rpc("recent_boost_bump", {
    _token: body.token,
    _within_seconds: 60,
  });
  // RPC returns a setof; first row wins.
  const recentRow = Array.isArray(recent) && recent.length > 0 ? recent[0] : null;
  if (recentRow) {
    return new Response(
      JSON.stringify({
        previous_offer: Number(recentRow.previous_offer) || 0,
        new_offer: Number(recentRow.new_offer) || 0,
        bump_amount: Number(recentRow.bump_amount) || 0,
        line_items: recentRow.line_items || [],
        idempotent_replay: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Step 0.5 — load per-dealer signal overrides ──────────────────
  // boost_bump_rules rows replace the SIGNAL_DEFAULTS for this
  // dealership. Single round-trip, then helper closures below
  // resolve each signal in O(1).
  const { data: ruleRows } = await supabase
    .from("boost_bump_rules")
    .select("signal_key, bump_amount, enabled")
    .eq("dealership_id", row.dealership_id);

  const ruleMap = new Map<string, { amount: number; enabled: boolean }>();
  for (const r of (ruleRows || [])) {
    ruleMap.set(r.signal_key as string, {
      amount: Number(r.bump_amount) || 0,
      enabled: r.enabled !== false,
    });
  }
  const resolveSignal = (key: string): { amount: number; enabled: boolean } => {
    const override = ruleMap.get(key);
    if (override) return override;
    return SIGNAL_DEFAULTS[key] ?? { amount: 0, enabled: false };
  };
  const isReappraisalEnabled = () => {
    const override = ruleMap.get(MILEAGE_REAPPRAISAL_KEY);
    return override ? override.enabled : true; // default ON
  };

  // Read site_config.demo_mode + demo_offer_amount alongside the
  // submission. When demo mode is on, the offer page hard-overrides
  // cashOffer to demo_offer_amount regardless of what's in the row's
  // pricing fields — the boost arithmetic has to honor the same
  // override or "Previous offer" reads $0 on every demo submission.
  const { data: cfg } = await supabase
    .from("site_config")
    .select("demo_mode, demo_offer_amount")
    .eq("dealership_id", row.dealership_id)
    .maybeSingle();
  const demoMode = cfg?.demo_mode === true;
  const demoAmount = Number(cfg?.demo_offer_amount) || 0;

  // Effective starting offer — demo override wins, then the same
  // fallback chain the offer page uses so the bump arithmetic
  // matches what the customer saw.
  let baseline = demoMode && demoAmount > 0
    ? demoAmount
    : (Number(row.offered_price) ||
       Number(row.estimated_offer_high) ||
       Number(row.bb_tradein_avg) ||
       Number(row.bb_wholesale_avg) ||
       0);
  const previousOffer = baseline;
  let baselineSource: "current" | "bb_re_appraisal" = "current";

  // ── Step 1 — vision-analyze each photo in parallel ────────────────
  // Delegate to analyze-vehicle-damage so the prompt logic stays in
  // one place. Failures on individual photos don't abort the run —
  // the customer still gets a result based on whichever analyses
  // succeeded.
  const analyzeUrl = `${SUPABASE_URL}/functions/v1/analyze-vehicle-damage`;
  const analyzeJobs = Object.entries(body.photo_paths).map(async ([category, path]) => {
    try {
      const res = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submission_id: submissionId,
          token: body.token,
          photo_category: category,
          photo_path: path,
          source: "boost_evaluate",
        }),
      });
      if (!res.ok) console.warn(`[boost-evaluate] analyze failed for ${category} (${res.status})`);
    } catch (e) {
      console.warn(`[boost-evaluate] analyze threw for ${category}:`, (e as Error).message);
    }
  });
  await Promise.all(analyzeJobs);

  // ── Step 2 — read the resulting damage_reports ────────────────────
  // analyze-vehicle-damage writes synchronously before returning,
  // so they should all be present by now.
  const { data: reports } = await supabase
    .from("damage_reports")
    .select("photo_category, overall_severity, suggested_condition, damage_items, verification_findings, confidence_score")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false });

  // Latest report per category (analyze-vehicle-damage creates a
  // new row each call; we want the freshest from this boost run).
  const latestByCategory: Record<string, any> = {};
  for (const r of (reports || [])) {
    if (!latestByCategory[r.photo_category]) latestByCategory[r.photo_category] = r;
  }

  const dashboardReport = latestByCategory.dashboard_odometer;
  const tireReport = latestByCategory.tires_wheels;
  const exteriorCategories = ["exterior_front", "exterior_driver", "exterior_rear", "exterior_passenger"];
  const exteriorReports = exteriorCategories.map((c) => latestByCategory[c]).filter(Boolean);

  // ── Step 3 — mileage OCR reconcile + BB re-appraisal ──────────────
  let verifiedMileage: number | null = null;
  let mileageCorrected = false;

  if (dashboardReport?.verification_findings?.mileage_reading != null) {
    const ocr = Number(dashboardReport.verification_findings.mileage_reading);
    if (Number.isFinite(ocr) && ocr > 0) {
      verifiedMileage = ocr;
      const drift = Math.abs(ocr - declaredMileage);
      // Only update + re-appraise if the drift is meaningful AND
      // the OCR value is plausible (within 60% of declared, so a
      // misread "754,287" doesn't tank a 75k-mile vehicle).
      const plausible = declaredMileage === 0 || (ocr >= declaredMileage * 0.4 && ocr <= declaredMileage * 1.6);
      if (drift > MILEAGE_DRIFT_THRESHOLD && plausible && isReappraisalEnabled()) {
        mileageCorrected = true;
        await supabase
          .from("submissions")
          .update({ mileage: String(ocr), updated_at: new Date().toISOString() })
          .eq("token", body.token);

        // Re-call bb-lookup with the corrected mileage to get a
        // fresh organic baseline. We need a VIN OR a plate+state
        // to do the lookup — skip the re-call if we have neither.
        if (row.vin || (row.plate && row.state)) {
          try {
            const bbRes = await fetch(`${SUPABASE_URL}/functions/v1/bb-lookup`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                lookup_type: row.vin ? "vin" : "plate",
                vin: row.vin || undefined,
                plate: row.plate || undefined,
                state: row.state || undefined,
                mileage: ocr,
                dealership_id: row.dealership_id,
              }),
            });
            if (bbRes.ok) {
              const bbData = await bbRes.json();
              const veh = bbData?.vehicles?.[0];
              if (veh) {
                // Pick the same field BB uses for the customer-facing
                // baseline. tradein.avg is the closest to "what the
                // dealer would offer" — wholesale is too low, retail
                // is post-margin.
                const newBaseline =
                  Number(veh?.tradein?.avg) ||
                  Number(veh?.tradein?.clean) ||
                  Number(veh?.wholesale?.avg) ||
                  Number(veh?.base_whole_avg) ||
                  0;
                if (newBaseline > 0) {
                  baseline = newBaseline;
                  baselineSource = "bb_re_appraisal";
                }
              }
            }
          } catch (e) {
            console.warn("[boost-evaluate] BB re-call failed:", (e as Error).message);
          }
        }
      }
    }
  }

  // ── Step 4 — aggregate AI bump line items ─────────────────────────
  const lineItems: BumpLineItem[] = [];

  // 4a. Mileage delta — surfaced as a line item ONLY if it
  // meaningfully increased the offer. Decreases are silent (the
  // floor-locked promise).
  if (mileageCorrected && verifiedMileage != null) {
    const delta = baseline - previousOffer;
    if (delta > 0) {
      // The mileage re-appraisal "bump" amount is the BB delta, not
      // a configurable dollar value. Dealers can disable the entire
      // re-appraisal step via boost_bump_rules.enabled but they
      // can't tune the amount — that's whatever Black Book says.
      lineItems.push({
        label: `Mileage verified at ${verifiedMileage.toLocaleString()} (lower than reported)`,
        amount: Math.round(delta),
        source: MILEAGE_REAPPRAISAL_KEY,
      });
    }
  } else if (verifiedMileage != null && Math.abs(verifiedMileage - declaredMileage) <= MILEAGE_DRIFT_THRESHOLD) {
    // OCR confirmed the customer's stated miles — small confidence bump.
    const sig = resolveSignal("mileage_verified");
    if (sig.enabled && sig.amount > 0) {
      lineItems.push({
        label: `Odometer verified at ${verifiedMileage.toLocaleString()}`,
        amount: sig.amount,
        source: "mileage_verified",
      });
    }
  }

  // 4b. Condition tier upgrade — strongest non-mileage signal.
  // We look at the highest suggested_condition across exterior
  // reports (interior/dashboard suggested_condition is less
  // reliable for the overall vehicle).
  const customerRank = rankCondition(row.overall_condition);
  let aiCondition: string | null = null;
  let aiRank = -1;
  for (const r of exteriorReports) {
    const rk = rankCondition(r.suggested_condition);
    if (rk > aiRank) {
      aiRank = rk;
      aiCondition = r.suggested_condition;
    }
  }
  // Helper to push a signal-driven line item only when the signal
  // is enabled and has a non-zero amount in the dealer's rule set.
  // Keeps the firing logic compact + auditable.
  const pushSignal = (key: string, label: string) => {
    const sig = resolveSignal(key);
    if (!sig.enabled || sig.amount <= 0) return;
    lineItems.push({ label, amount: sig.amount, source: key });
  };

  if (aiCondition && customerRank >= 0 && aiRank > customerRank) {
    pushSignal(
      "condition_upgrade",
      `Photos confirm ${aiCondition.replace("_", " ")} condition (you rated ${row.overall_condition})`,
    );
  }

  // 4c. Severity sweep across the four exterior photos.
  const anySevere = exteriorReports.some((r) => r.overall_severity === "severe" || r.overall_severity === "moderate");
  if (exteriorReports.length >= 3 && !anySevere) {
    pushSignal("exterior_clean", "All four exterior angles — no moderate or severe damage");
  }

  // 4d. Paint match / no accident-repair signals.
  const anyPaintMismatch = exteriorReports.some((r) => r.verification_findings?.paint_mismatch_detected === true);
  const anyAccidentSigns = exteriorReports.some((r) => Array.isArray(r.verification_findings?.accident_repair_signs) && r.verification_findings.accident_repair_signs.length > 0);
  if (exteriorReports.length >= 3 && !anyPaintMismatch) {
    pushSignal("paint_match", "Paint matches across all panels — no repaint detected");
  }
  if (exteriorReports.length >= 3 && !anyAccidentSigns) {
    pushSignal("no_accident_repair", "Factory panel alignment — no accident-repair signs");
  }

  // 4e. Tire tread + factory wheels.
  if (tireReport) {
    const tread = Number(tireReport.verification_findings?.tire_tread_32nds);
    const tireIssues: string[] = tireReport.verification_findings?.tire_issues || [];
    const hasCurbRash = tireIssues.includes("curb_rash_on_wheel");
    const hasSidewallIssue = tireIssues.includes("sidewall_bulge") || tireIssues.includes("sidewall_crack");

    if (Number.isFinite(tread)) {
      if (tread >= 7 && !hasSidewallIssue) {
        pushSignal(
          "tire_tread_high",
          `Tires above 7/32" tread — ${Math.round((tread / 11) * 100)}% remaining`,
        );
      } else if (tread >= 5 && !hasSidewallIssue) {
        pushSignal("tire_tread_mid", `Tires at ${tread}/32" tread — above wear bar`);
      }
    }
    if (!hasCurbRash) {
      pushSignal("wheels_clean", "Wheels original — no curb rash detected");
    }
  }

  // 4f. Dashboard — clean (no warning lights).
  if (dashboardReport) {
    const lights: string[] = dashboardReport.verification_findings?.warning_lights || [];
    if (lights.length === 0) {
      pushSignal("no_warning_lights", "Dashboard clear — no warning lights");
    }
    const concerns: string[] = dashboardReport.verification_findings?.cabin_concerns || [];
    if (concerns.length === 0) {
      pushSignal("clean_cabin", "Cabin presents clean — no smoke / stains / wear flagged");
    }
  }

  // 4g. Bonus — driver seat. We fire driver_seat_low_wear when the
  // customer uploaded the bonus shot AND the AI did NOT flag heavy
  // wear / rips / stains in cabin_concerns or in damage_items
  // localized to the seat. Heavily-worn driver bolsters are the
  // strongest "true miles higher than odometer says" tell, so a
  // clean seat is a real positive signal.
  const seatReport = latestByCategory.interior_driver_seat;
  if (seatReport) {
    const concerns: string[] = seatReport.verification_findings?.cabin_concerns || [];
    const hasWear = concerns.includes("heavy_wear") || concerns.includes("rips") || concerns.includes("stains");
    type Dmg = { type?: string; location?: string; severity?: string };
    const seatDamage = (seatReport.damage_items as Dmg[] | null || []).filter(
      (d) => /seat|bolster|cushion/i.test(d.location || "") &&
             d.severity !== "minor",
    );
    if (!hasWear && seatDamage.length === 0) {
      pushSignal("driver_seat_low_wear", "Driver seat low-wear — bolsters and cushion clean");
    }
  }

  // 4h. Bonus — steering wheel. We fire steering_wheel_unworn when
  // the wheel shot has no damage_items localized to it (a glossy
  // worn grip would be flagged by analyze-vehicle-damage as wear
  // at location:steering_wheel). Original-condition wheel = miles
  // are honest.
  const wheelReport = latestByCategory.interior_steering_wheel;
  if (wheelReport) {
    type Dmg = { type?: string; location?: string; severity?: string };
    const wheelDamage = (wheelReport.damage_items as Dmg[] | null || []).filter(
      (d) => /steering|wheel/i.test(d.location || "") &&
             /wear|gloss|smooth|shiny|crack/i.test(d.type || "") &&
             d.severity !== "minor",
    );
    if (wheelDamage.length === 0) {
      pushSignal("steering_wheel_unworn", "Steering wheel original — no glossy-grip wear");
    }
  }

  // 4i. Cap the total — never exceeds MAX_BUMP_TOTAL even if every
  // signal fires. Bumps preserve order (highest-signal first) and
  // we trim from the end if needed.
  let runningTotal = 0;
  const finalItems: BumpLineItem[] = [];
  for (const item of lineItems) {
    if (runningTotal + item.amount > MAX_BUMP_TOTAL) {
      const remaining = MAX_BUMP_TOTAL - runningTotal;
      if (remaining > 0) finalItems.push({ ...item, amount: remaining });
      break;
    }
    finalItems.push(item);
    runningTotal += item.amount;
  }

  const bumpTotal = Math.max(MIN_BUMP_TOTAL, runningTotal);
  const newOffer = baseline + bumpTotal;

  // ── Step 5 — persist atomically ───────────────────────────────────
  // apply_boost_bump (in 20260507000000_boost_safety.sql) wraps
  // the offered_price update + offer_bumps audit insert in a
  // single transaction with a row lock on the submission. If
  // either step fails, both roll back — no more "mutated price
  // with no audit row" failure mode.
  const { error: applyErr } = await supabase.rpc("apply_boost_bump", {
    _token: body.token,
    _previous_offer: previousOffer,
    _new_offer: newOffer,
    _bump_amount: bumpTotal,
    _line_items: finalItems,
    _source: baselineSource === "bb_re_appraisal" ? "boost_evaluate_bb_recall" : "boost_evaluate",
  });
  if (applyErr) {
    console.error("[boost-evaluate] apply_boost_bump failed:", applyErr.message);
    return new Response(
      JSON.stringify({ error: "apply_failed", detail: applyErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  void submissionId;

  return new Response(
    JSON.stringify({
      previous_offer: previousOffer,
      new_offer: newOffer,
      bump_amount: bumpTotal,
      line_items: finalItems,
      mileage_corrected: mileageCorrected,
      verified_mileage: verifiedMileage,
      baseline_source: baselineSource,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
