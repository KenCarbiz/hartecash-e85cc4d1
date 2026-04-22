import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { dealership_id, bb_class_name, overall_condition, mileage } = await req.json();

    if (!dealership_id || !bb_class_name || !overall_condition) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check total finalized count for this dealership
    const { count: totalFinalized } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", dealership_id)
      .eq("appraisal_finalized", true)
      .not("outcome_accepted", "is", null);

    if ((totalFinalized ?? 0) < 10) {
      return new Response(JSON.stringify({ total_finalized: totalFinalized ?? 0, insight: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine mileage band
    const mileageNum = typeof mileage === "number" ? mileage : parseInt(String(mileage || "0")) || 0;
    let mileageBandMin = 0;
    let mileageBandMax = 30000;
    if (mileageNum >= 120000) { mileageBandMin = 120000; mileageBandMax = 999999; }
    else if (mileageNum >= 75000) { mileageBandMin = 75000; mileageBandMax = 119999; }
    else if (mileageNum >= 30000) { mileageBandMin = 30000; mileageBandMax = 74999; }

    // Query matching submissions
    const eighteenMonthsAgo = new Date();
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

    const { data: matches } = await supabase
      .from("submissions")
      .select("outcome_accepted, outcome_sale_price, outcome_days_to_sale, outcome_recon_actual, bb_retail_avg, appraisal_finalized_at")
      .eq("dealership_id", dealership_id)
      .eq("bb_class_name", bb_class_name)
      .eq("overall_condition", overall_condition)
      .eq("appraisal_finalized", true)
      .not("outcome_accepted", "is", null)
      .gte("appraisal_finalized_at", eighteenMonthsAgo.toISOString());

    if (!matches || matches.length < 15) {
      return new Response(JSON.stringify({ total_finalized: totalFinalized ?? 0, insight: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate aggregates
    const sampleSize = matches.length;
    const acceptedCount = matches.filter(m => m.outcome_accepted === true).length;
    const avgAcceptanceRate = acceptedCount / sampleSize;

    const daysToSaleArr = matches.filter(m => m.outcome_days_to_sale != null).map(m => m.outcome_days_to_sale!);
    const avgDaysToSale = daysToSaleArr.length > 0 ? daysToSaleArr.reduce((a, b) => a + b, 0) / daysToSaleArr.length : 0;

    const reconArr = matches.filter(m => m.outcome_recon_actual != null).map(m => m.outcome_recon_actual!);
    const avgReconActual = reconArr.length > 0 ? reconArr.reduce((a, b) => a + b, 0) / reconArr.length : 0;

    const realizationArr = matches.filter(m => m.outcome_sale_price != null && m.bb_retail_avg != null && Number(m.bb_retail_avg) > 0)
      .map(m => Number(m.outcome_sale_price) / Number(m.bb_retail_avg));
    const priceRealizationPct = realizationArr.length > 0 ? realizationArr.reduce((a, b) => a + b, 0) / realizationArr.length : 1.0;

    // Recommended basis adjustment: (0.72 - acceptance_rate) * 15 clamped to ±8%
    const rawAdj = (0.72 - avgAcceptanceRate) * 15;
    const recommendedBasisAdjustmentPct = Math.max(-8, Math.min(8, rawAdj));

    const insight = {
      sampleSize,
      avgAcceptanceRate,
      avgDaysToSale,
      avgReconActual,
      priceRealizationPct,
      recommendedBasisAdjustmentPct,
    };

    return new Response(JSON.stringify({ total_finalized: totalFinalized ?? 0, insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
