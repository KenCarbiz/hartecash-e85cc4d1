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

// Per-finding dollar values. Ordered by signal strength (research
// notes above). Tunable per-dealer in a future migration; for now
// these constants keep the surface predictable and the audit trail
// readable.
const BUMP_AMOUNTS = {
  conditionTierUp:        450,   // suggested_condition > customer-rated
  noPaintMismatch:        225,   // exterior shots clean, no panel mismatch
  noAccidentRepair:       175,   // no factory-replacement signals
  factoryWheelsClean:     200,   // tire+wheel shot: no aftermarket, no curb rash
  highTireTread:          200,   // tire tread > 7/32 (more than half)
  midTireTread:           100,   // tire tread 5–7/32
  cleanDashboard:         200,   // no warning lights detected
  cleanInteriorPanels:    125,   // dashboard photo: no cabin concerns
  noSevereExteriorDamage: 175,   // none of the four exterior shots flagged severe
  headlightClarity:       100,   // bumper photo: no haze flag
};

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

  // Effective starting offer — same fallback chain the offer page
  // uses so the bump arithmetic matches what the customer saw.
  let baseline =
    Number(row.offered_price) ||
    Number(row.estimated_offer_high) ||
    Number(row.bb_tradein_avg) ||
    Number(row.bb_wholesale_avg) ||
    0;
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
      if (drift > MILEAGE_DRIFT_THRESHOLD && plausible) {
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
      lineItems.push({
        label: `Mileage verified at ${verifiedMileage.toLocaleString()} (lower than reported)`,
        amount: Math.round(delta),
        source: "ocr_mileage_reappraisal",
      });
    }
  } else if (verifiedMileage != null && Math.abs(verifiedMileage - declaredMileage) <= MILEAGE_DRIFT_THRESHOLD) {
    // OCR confirmed the customer's stated miles — small confidence bump.
    lineItems.push({
      label: `Odometer verified at ${verifiedMileage.toLocaleString()}`,
      amount: 100,
      source: "ocr_mileage_verified",
    });
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
  if (aiCondition && customerRank >= 0 && aiRank > customerRank) {
    lineItems.push({
      label: `Photos confirm ${aiCondition.replace("_", " ")} condition (you rated ${row.overall_condition})`,
      amount: BUMP_AMOUNTS.conditionTierUp,
      source: "condition_upgrade",
    });
  }

  // 4c. Severity sweep across the four exterior photos.
  const anySevere = exteriorReports.some((r) => r.overall_severity === "severe" || r.overall_severity === "moderate");
  if (exteriorReports.length >= 3 && !anySevere) {
    lineItems.push({
      label: "All four exterior angles — no moderate or severe damage",
      amount: BUMP_AMOUNTS.noSevereExteriorDamage,
      source: "exterior_clean",
    });
  }

  // 4d. Paint match / no accident-repair signals.
  const anyPaintMismatch = exteriorReports.some((r) => r.verification_findings?.paint_mismatch_detected === true);
  const anyAccidentSigns = exteriorReports.some((r) => Array.isArray(r.verification_findings?.accident_repair_signs) && r.verification_findings.accident_repair_signs.length > 0);
  if (exteriorReports.length >= 3 && !anyPaintMismatch) {
    lineItems.push({
      label: "Paint matches across all panels — no repaint detected",
      amount: BUMP_AMOUNTS.noPaintMismatch,
      source: "paint_match",
    });
  }
  if (exteriorReports.length >= 3 && !anyAccidentSigns) {
    lineItems.push({
      label: "Factory panel alignment — no accident-repair signs",
      amount: BUMP_AMOUNTS.noAccidentRepair,
      source: "no_accident",
    });
  }

  // 4e. Tire tread + factory wheels.
  if (tireReport) {
    const tread = Number(tireReport.verification_findings?.tire_tread_32nds);
    const tireIssues: string[] = tireReport.verification_findings?.tire_issues || [];
    const hasCurbRash = tireIssues.includes("curb_rash_on_wheel");
    const hasSidewallIssue = tireIssues.includes("sidewall_bulge") || tireIssues.includes("sidewall_crack");

    if (Number.isFinite(tread)) {
      if (tread >= 7 && !hasSidewallIssue) {
        lineItems.push({
          label: `Tires above 7/32" tread — ${Math.round((tread / 11) * 100)}% remaining`,
          amount: BUMP_AMOUNTS.highTireTread,
          source: "tire_tread_high",
        });
      } else if (tread >= 5 && !hasSidewallIssue) {
        lineItems.push({
          label: `Tires at ${tread}/32" tread — above wear bar`,
          amount: BUMP_AMOUNTS.midTireTread,
          source: "tire_tread_mid",
        });
      }
    }
    if (!hasCurbRash) {
      lineItems.push({
        label: "Wheels original — no curb rash detected",
        amount: BUMP_AMOUNTS.factoryWheelsClean,
        source: "wheels_clean",
      });
    }
  }

  // 4f. Dashboard — clean (no warning lights).
  if (dashboardReport) {
    const lights: string[] = dashboardReport.verification_findings?.warning_lights || [];
    if (lights.length === 0) {
      lineItems.push({
        label: "Dashboard clear — no warning lights",
        amount: BUMP_AMOUNTS.cleanDashboard,
        source: "no_warning_lights",
      });
    }
    const concerns: string[] = dashboardReport.verification_findings?.cabin_concerns || [];
    if (concerns.length === 0) {
      lineItems.push({
        label: "Cabin presents clean — no smoke / stains / wear flagged",
        amount: BUMP_AMOUNTS.cleanInteriorPanels,
        source: "clean_cabin",
      });
    }
  }

  // 4g. Cap the total — never exceeds MAX_BUMP_TOTAL even if every
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

  // ── Step 5 — persist ──────────────────────────────────────────────
  await supabase
    .from("submissions")
    .update({
      offered_price: newOffer,
      updated_at: new Date().toISOString(),
    })
    .eq("token", body.token);

  // Audit trail — best-effort.
  try {
    await supabase.from("offer_bumps").insert({
      submission_id: submissionId,
      dealership_id: row.dealership_id,
      previous_offer: previousOffer,
      new_offer: newOffer,
      bump_amount: bumpTotal,
      line_items: finalItems,
      source: baselineSource === "bb_re_appraisal" ? "boost_evaluate_bb_recall" : "boost_evaluate",
    });
  } catch (e) {
    console.warn("[boost-evaluate] audit insert skipped:", (e as Error).message);
  }

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
