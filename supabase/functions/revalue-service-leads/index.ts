import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EARLY_STATUSES = ["new", "contacted", "not_contacted", "partial"];
const DEFAULT_LOOKBACK_DAYS = 90;

// Thresholds (USD)
const APPRECIATE_THRESHOLD = 500;
const HOT_THRESHOLD = 1500;
const DEPRECIATE_THRESHOLD = -500;

interface RevalueRequest {
  dealership_id?: string;
  days_lookback?: number;
}

interface Summary {
  processed: number;
  appreciated: number;
  depreciated: number;
  unchanged: number;
  notifications_sent: number;
  total_equity_unlocked: number;
  errors: Array<{ submission_id: string; error: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const summary: Summary = {
    processed: 0,
    appreciated: 0,
    depreciated: 0,
    unchanged: 0,
    notifications_sent: 0,
    total_equity_unlocked: 0,
    errors: [],
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse optional request body
    let dealership_id: string | undefined;
    let days_lookback = DEFAULT_LOOKBACK_DAYS;
    if (req.method === "POST") {
      try {
        const body: RevalueRequest = await req.json().catch(() => ({}));
        if (body?.dealership_id) dealership_id = body.dealership_id;
        if (body?.days_lookback && Number.isFinite(body.days_lookback)) {
          days_lookback = Math.max(1, Math.floor(body.days_lookback));
        }
      } catch {
        // no body — use defaults
      }
    }

    const sinceIso = new Date(
      Date.now() - days_lookback * 24 * 60 * 60 * 1000
    ).toISOString();

    // Step 1: Find eligible leads
    let query = supabase
      .from("submissions")
      .select(
        "id, token, name, email, vin, mileage, zip, dealership_id, lead_source, progress_status, offered_price, loan_payoff_amount, bb_wholesale_avg, bb_tradein_avg, bb_retail_avg, estimated_offer_high, estimated_equity, created_at"
      )
      .eq("lead_source", "service")
      .in("progress_status", EARLY_STATUSES)
      .gte("created_at", sinceIso)
      .is("offered_price", null)
      .not("vin", "is", null);

    if (dealership_id) {
      query = query.eq("dealership_id", dealership_id);
    }

    const { data: leads, error: leadsErr } = await query;
    if (leadsErr) {
      throw new Error(`Failed to query leads: ${leadsErr.message}`);
    }

    console.log(
      `revalue-service-leads: found ${leads?.length || 0} eligible leads ` +
        `(lookback=${days_lookback}d, dealership=${dealership_id || "all"})`
    );

    for (const lead of leads || []) {
      summary.processed++;
      try {
        // Step 2: Re-run Black Book lookup
        const { data: bbResp, error: bbErr } = await supabase.functions.invoke(
          "bb-lookup",
          {
            body: {
              lookup_type: "vin",
              vin: lead.vin,
              mileage: lead.mileage ? Number(lead.mileage) : undefined,
              zip: lead.zip || undefined,
            },
          }
        );

        if (bbErr) {
          throw new Error(`bb-lookup invoke failed: ${bbErr.message}`);
        }
        if (bbResp?.error) {
          throw new Error(`bb-lookup returned error: ${bbResp.error}`);
        }

        const vehicle = bbResp?.vehicles?.[0];
        if (!vehicle) {
          throw new Error("bb-lookup returned no vehicles");
        }

        const newWholesaleAvg = Number(vehicle.wholesale?.avg || 0);
        const newTradeinAvg = Number(vehicle.tradein?.avg || 0);
        const newRetailAvg = Number(vehicle.retail?.avg || 0);

        const oldWholesaleAvg = Number(lead.bb_wholesale_avg || 0);
        const oldTradeinAvg = Number(lead.bb_tradein_avg || 0);
        const oldRetailAvg = Number(lead.bb_retail_avg || 0);

        // Use retail_avg as the primary comparison signal (what the customer
        // most closely perceives as "the offer"); fall back to tradein if retail
        // isn't populated on the old record.
        const oldPrimary = oldRetailAvg || oldTradeinAvg || oldWholesaleAvg;
        const newPrimary = newRetailAvg || newTradeinAvg || newWholesaleAvg;
        const valueChange = newPrimary - oldPrimary;

        // Recompute estimated_offer_high and equity
        // estimated_offer_high mirrors the retail_avg the customer saw.
        const newEstimatedOfferHigh = newRetailAvg || null;
        const newEstimatedEquity =
          lead.loan_payoff_amount != null && newEstimatedOfferHigh != null
            ? Number(newEstimatedOfferHigh) - Number(lead.loan_payoff_amount)
            : null;

        // Step 3 + 4: Classify + update submission
        let flag: "appreciating" | "hot" | "depreciating" | "unchanged" =
          "unchanged";
        if (valueChange >= HOT_THRESHOLD) flag = "hot";
        else if (valueChange >= APPRECIATE_THRESHOLD) flag = "appreciating";
        else if (valueChange <= DEPRECIATE_THRESHOLD) flag = "depreciating";

        const { error: updateErr } = await supabase
          .from("submissions")
          .update({
            bb_wholesale_avg: newWholesaleAvg || null,
            bb_tradein_avg: newTradeinAvg || null,
            bb_retail_avg: newRetailAvg || null,
            estimated_offer_high: newEstimatedOfferHigh,
            estimated_equity: newEstimatedEquity,
            last_revalued_at: new Date().toISOString(),
            revaluation_count: ((lead as any).revaluation_count || 0) + 1,
          })
          .eq("id", lead.id);

        if (updateErr) {
          throw new Error(`Failed to update submission: ${updateErr.message}`);
        }

        // Step 5: Log + notify
        let notificationSent = false;
        const shouldNotify = flag === "hot" && !!lead.email;

        if (shouldNotify) {
          try {
            const { error: notifyErr } = await supabase.functions.invoke(
              "send-notification",
              {
                body: {
                  trigger_key: "customer_offer_increased",
                  submission_id: lead.id,
                },
              }
            );
            if (notifyErr) {
              console.error(
                `Failed to send notification for ${lead.id}: ${notifyErr.message}`
              );
            } else {
              notificationSent = true;
              summary.notifications_sent++;
            }
          } catch (e) {
            console.error(
              `Notification error for ${lead.id}:`,
              (e as Error).message
            );
          }
        }

        // Insert into revaluation_log for every processed lead
        const { error: logErr } = await supabase
          .from("revaluation_log")
          .insert({
            submission_id: lead.id,
            old_retail_avg: oldRetailAvg || null,
            new_retail_avg: newRetailAvg || null,
            old_tradein_avg: oldTradeinAvg || null,
            new_tradein_avg: newTradeinAvg || null,
            value_change: valueChange,
            notification_sent: notificationSent,
          });
        if (logErr) {
          console.error(
            `Failed to insert revaluation_log for ${lead.id}: ${logErr.message}`
          );
        }

        // Counters
        if (flag === "hot" || flag === "appreciating") {
          summary.appreciated++;
          if (valueChange > 0) summary.total_equity_unlocked += valueChange;
        } else if (flag === "depreciating") {
          summary.depreciated++;
        } else {
          summary.unchanged++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error(`Error processing lead ${lead.id}:`, msg);
        summary.errors.push({ submission_id: lead.id, error: msg });
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("revalue-service-leads fatal error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        ...summary,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
