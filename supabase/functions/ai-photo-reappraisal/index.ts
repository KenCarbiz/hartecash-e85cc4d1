import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, callerCanActOnTenant, forbidden } from "../_shared/auth.ts";

/**
 * AI Photo Re-Appraisal — takes a submission_id, reads the
 * already-computed ai_condition_score from analyze-vehicle-damage,
 * compares it to the customer's self-reported condition, and writes a
 * recommended offer adjustment to ai_reappraisal_log.
 *
 * This function is INTENTIONALLY cheap — it does not call a vision
 * model itself. It relies on analyze-vehicle-damage having already
 * run (which happens automatically on every photo upload via
 * UploadPhotos.tsx). If damage_reports are missing or stale, it
 * reports nothing and exits cleanly.
 *
 * Auto-bump safety limits are enforced in this function too — see
 * shouldAutoApply() at the bottom. When the auto-bump toggle is on
 * and every safety check passes, the function applies the new offer
 * directly to submissions.offered_price (which triggers the
 * database-level "subject to inspection" flag via
 * auto_flag_subject_to_inspection()), writes an activity_log entry,
 * and fires the customer_offer_increased notification.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Condition rank — higher is better. Mirrors the client-side
// CONDITION_RANK in src/lib/offerCalculator.ts so the math stays
// consistent between the live calculator and this re-appraisal pass.
const CONDITION_RANK: Record<string, number> = {
  poor: 0,
  fair: 1,
  good: 2,
  very_good: 3,
  excellent: 4,
  xclean: 4,
};

function normalizeCondition(c: string | null | undefined): string {
  if (!c) return "good";
  const lower = c.toLowerCase().replace(/\s+/g, "_");
  if (lower in CONDITION_RANK) return lower;
  // Map common synonyms
  if (lower.includes("excel")) return "excellent";
  if (lower.includes("great") || lower.includes("very")) return "very_good";
  if (lower.includes("good")) return "good";
  if (lower.includes("fair") || lower.includes("average") || lower.includes("avg")) return "fair";
  if (lower.includes("poor") || lower.includes("rough")) return "poor";
  return "good";
}

/**
 * Core re-appraisal math. Given the reported condition and what the
 * AI saw, return a dollar adjustment to apply to the current offer.
 * Mirrors calcAIConditionAdjustment in src/lib/offerCalculator.ts but
 * stands alone so this edge function doesn't need client imports.
 */
function computeAdjustment(
  baseOffer: number,
  reportedCondition: string,
  aiConditionScore: string | null,
  aiConfidence: number,
): { deltaDollars: number; reason: string } {
  if (!aiConditionScore) {
    return { deltaDollars: 0, reason: "No AI condition score available yet." };
  }
  if (aiConfidence < 60) {
    return {
      deltaDollars: 0,
      reason: `AI confidence ${aiConfidence}% is below the 60% minimum — no adjustment recommended.`,
    };
  }

  const reportedRank = CONDITION_RANK[normalizeCondition(reportedCondition)] ?? 2;
  const aiRank = CONDITION_RANK[normalizeCondition(aiConditionScore)] ?? 2;

  if (reportedRank === aiRank) {
    return {
      deltaDollars: 0,
      reason: `AI confirmed the customer's self-reported condition (${reportedCondition}). No adjustment needed.`,
    };
  }

  // If AI saw WORSE condition than reported, return a NEGATIVE delta
  // (recommendation to reduce — the appraiser may or may not act on it).
  // If AI saw BETTER condition than reported, return a POSITIVE delta
  // (recommendation to bump). This is the money path.
  let pct = 0;
  if (aiRank > reportedRank) {
    const gap = aiRank - reportedRank;
    if (gap >= 2) pct = 5;  // customer said "fair" but AI says "excellent" → bump 5%
    else if (gap === 1) pct = 3; // one tier up → bump 3%
  } else {
    const gap = reportedRank - aiRank;
    if (gap >= 3) pct = -15;
    else if (gap === 2) pct = -8;
    else if (gap === 1) pct = -3;
  }

  if (pct === 0) {
    return { deltaDollars: 0, reason: "No material difference detected." };
  }

  const raw = Math.round(baseOffer * (pct / 100));
  // Hard cap at ±$2500 per re-appraisal (matches offerCalculator).
  const capped = Math.max(-2500, Math.min(2500, raw));

  const direction = capped > 0 ? "bump" : "reduction";
  const reason = pct > 0
    ? `Photos indicate ${aiConditionScore} condition vs "${reportedCondition}" self-rated — recommend ${direction} of $${Math.abs(capped).toLocaleString()} (${pct}%).`
    : `Photos indicate ${aiConditionScore} condition vs "${reportedCondition}" self-rated — recommend ${direction} of $${Math.abs(capped).toLocaleString()} (${pct}%).`;

  return { deltaDollars: capped, reason };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submission_id, source } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Load submission + dealer config + damage reports
    const { data: sub, error: subErr } = await supabase
      .from("submissions")
      .select("id, dealership_id, offered_price, estimated_offer_high, overall_condition, ai_condition_score, ai_damage_summary, name, email, phone, vehicle_year, vehicle_make, vehicle_model")
      .eq("id", submission_id)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Staff-only — anonymous callers are rejected; staff must match tenant.
    const caller = await resolveCaller(
      req,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      serviceKey,
    );
    if (!callerCanActOnTenant(caller, sub.dealership_id)) {
      return forbidden(corsHeaders);
    }

    const { data: cfg } = await supabase
      .from("site_config")
      .select("ai_photo_reappraisal, ai_auto_bump_enabled, ai_auto_bump_max_pct, ai_auto_bump_max_dollars, ai_auto_bump_daily_cap, ai_auto_bump_confidence_floor")
      .eq("dealership_id", sub.dealership_id || "default")
      .maybeSingle();

    // Master toggle off → no-op (but we still return 200 so the caller
    // doesn't error-log endlessly in production).
    if (!cfg || !(cfg as any).ai_photo_reappraisal) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "ai_photo_reappraisal toggle is off" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Gather damage reports — we need confidence + photo count
    const { data: reports } = await supabase
      .from("damage_reports")
      .select("confidence_score, suggested_condition, overall_severity")
      .eq("submission_id", submission_id);

    const photosAnalyzed = reports?.length || 0;
    if (photosAnalyzed === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No damage reports yet — photos may still be processing" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Average the per-photo confidence to get an overall signal
    const avgConfidence =
      reports!.reduce((sum, r: any) => sum + (r.confidence_score || 0), 0) /
      Math.max(photosAnalyzed, 1);

    // 3. Compute adjustment
    const currentOffer = Number(sub.offered_price || sub.estimated_offer_high || 0);
    const { deltaDollars, reason } = computeAdjustment(
      currentOffer,
      sub.overall_condition || "good",
      (sub as any).ai_condition_score,
      Math.round(avgConfidence),
    );

    // Nothing to recommend → log nothing, return clean
    if (deltaDollars === 0) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason,
          photos_analyzed: photosAnalyzed,
          ai_confidence: Math.round(avgConfidence),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const suggestedOffer = Math.max(0, currentOffer + deltaDollars);

    // 4. Decide: log as 'suggested' OR auto-apply?
    const {
      eligible: autoEligible,
      blockedReason,
    } = await shouldAutoApply(
      supabase,
      sub,
      cfg as any,
      currentOffer,
      suggestedOffer,
      deltaDollars,
      Math.round(avgConfidence),
    );

    let status = "suggested";
    if (autoEligible) status = "auto_applied";
    else if (blockedReason) status = blockedReason; // 'blocked_cap' or 'blocked_confidence'

    const { data: logRow, error: logErr } = await supabase
      .from("ai_reappraisal_log")
      .insert({
        submission_id,
        dealership_id: sub.dealership_id || "default",
        old_offer: currentOffer || null,
        suggested_offer: suggestedOffer,
        delta: deltaDollars,
        reported_condition: sub.overall_condition || null,
        ai_condition_score: (sub as any).ai_condition_score || null,
        ai_damage_summary: (sub as any).ai_damage_summary || null,
        ai_confidence: Math.round(avgConfidence),
        photos_analyzed: photosAnalyzed,
        reason,
        status,
      })
      .select()
      .single();

    if (logErr) {
      console.error("ai_reappraisal_log insert failed:", logErr);
    }

    // 5. If auto-applying, update the submission + notify the customer
    if (autoEligible && deltaDollars > 0) {
      const { error: updateErr } = await supabase
        .from("submissions")
        .update({
          offered_price: suggestedOffer,
          // offer_subject_to_inspection will be set automatically by the
          // auto_flag_subject_to_inspection() BEFORE trigger.
        })
        .eq("id", submission_id);

      if (updateErr) {
        console.error("Failed to auto-apply bump:", updateErr);
      } else {
        // Audit trail
        await supabase.from("activity_log").insert({
          submission_id,
          action: "AI Auto-Bump Applied",
          old_value: currentOffer ? `$${currentOffer.toLocaleString()}` : "None",
          new_value: `$${suggestedOffer.toLocaleString()}`,
          performed_by: `AI (${source || "photo_upload"})`,
        });

        // Customer notification (respects opt-outs + quiet hours already)
        try {
          await supabase.functions.invoke("send-notification", {
            body: {
              trigger_key: "customer_offer_increased",
              submission_id,
            },
          });
        } catch (e) {
          console.error("Notification failed:", (e as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({
        log_id: logRow?.id,
        old_offer: currentOffer,
        suggested_offer: suggestedOffer,
        delta: deltaDollars,
        ai_confidence: Math.round(avgConfidence),
        photos_analyzed: photosAnalyzed,
        status,
        reason,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-photo-reappraisal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Gatekeeper for auto-apply. All four checks must pass:
 *   1. Dealer has ai_auto_bump_enabled = true
 *   2. AI confidence >= ai_auto_bump_confidence_floor
 *   3. Delta is within the per-vehicle cap (max pct OR max dollars)
 *   4. Today's cumulative auto-bumps haven't exceeded the daily cap
 *
 * Negative deltas (condition worse than reported) are never
 * auto-applied — only the AI-bump path auto-applies. A human still
 * has to confirm a reduction so the customer doesn't see a number
 * drop automatically.
 */
async function shouldAutoApply(
  supabase: any,
  sub: any,
  cfg: any,
  currentOffer: number,
  suggestedOffer: number,
  deltaDollars: number,
  confidence: number,
): Promise<{ eligible: boolean; blockedReason: string | null }> {
  // Never auto-apply a reduction
  if (deltaDollars <= 0) return { eligible: false, blockedReason: null };

  if (!cfg.ai_auto_bump_enabled) return { eligible: false, blockedReason: null };

  const confidenceFloor = Number(cfg.ai_auto_bump_confidence_floor || 70);
  if (confidence < confidenceFloor) {
    return { eligible: false, blockedReason: "blocked_confidence" };
  }

  // Per-vehicle cap: the bump must be within BOTH the max pct AND max dollars
  const maxPct = Number(cfg.ai_auto_bump_max_pct || 15);
  const maxDollars = Number(cfg.ai_auto_bump_max_dollars || 2000);
  if (currentOffer > 0 && deltaDollars / currentOffer > maxPct / 100) {
    return { eligible: false, blockedReason: "blocked_cap" };
  }
  if (deltaDollars > maxDollars) {
    return { eligible: false, blockedReason: "blocked_cap" };
  }

  // Daily cap across the whole dealership
  const dailyCap = Number(cfg.ai_auto_bump_daily_cap || 10000);
  if (dailyCap > 0) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todayRows } = await supabase
      .from("ai_reappraisal_log")
      .select("delta")
      .eq("dealership_id", sub.dealership_id || "default")
      .eq("status", "auto_applied")
      .gte("created_at", todayStart.toISOString());
    const todayTotal = (todayRows || []).reduce(
      (sum: number, r: any) => sum + Math.max(0, Number(r.delta || 0)),
      0,
    );
    if (todayTotal + deltaDollars > dailyCap) {
      return { eligible: false, blockedReason: "blocked_cap" };
    }
  }

  return { eligible: true, blockedReason: null };
}
