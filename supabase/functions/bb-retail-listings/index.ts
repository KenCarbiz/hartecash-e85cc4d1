import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RETAIL_BASE = "https://service.blackbookcloud.com/RetailAPI/RetailAPI";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const username = Deno.env.get("BLACKBOOK_USERNAME");
  const password = Deno.env.get("BLACKBOOK_PASSWORD");

  if (!username || !password) {
    return new Response(JSON.stringify({ error: "Black Book credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const { vin, uvc, zipcode, radius_miles = 100, include_listings = false } = body;

    if (!vin && !uvc) {
      return new Response(JSON.stringify({ error: "VIN or UVC is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!zipcode) {
      return new Response(JSON.stringify({ error: "Zipcode is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const credentials = btoa(`${username}:${password}`);
    const authHeaders = {
      "Authorization": `Basic ${credentials}`,
      "Accept": "application/json",
    };

    // 1. Fetch listing statistics
    const statsParams = new URLSearchParams({
      zipcode,
      radius_miles: String(radius_miles),
      all_trims: "false",
      duplicate_vins: "false",
    });
    if (vin) statsParams.set("vin", vin);
    if (uvc) statsParams.set("uvc", uvc);

    const statsUrl = `${RETAIL_BASE}/ListingsStatistics?${statsParams.toString()}`;
    console.log("BB Retail Stats URL:", statsUrl);

    const statsRes = await fetch(statsUrl, { headers: authHeaders });
    const statsText = await statsRes.text();
    console.log("BB Retail Stats status:", statsRes.status, "body length:", statsText.length);

    if (!statsRes.ok) {
      console.error("BB Retail Stats HTTP error:", statsRes.status, statsText.substring(0, 500));
      return new Response(JSON.stringify({ error: `Black Book returned ${statsRes.status}: ${statsText.substring(0, 200)}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!statsText || statsText.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Black Book returned an empty response. This vehicle may not have retail listing data available.", statistics: null, listings: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let statsData: Record<string, unknown>;
    try {
      statsData = JSON.parse(statsText);
    } catch {
      console.error("BB Retail Stats JSON parse error, raw:", statsText.substring(0, 500));
      return new Response(JSON.stringify({ error: "Invalid response from Black Book API", statistics: null, listings: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // deno-lint-ignore no-explicit-any
    const sd = statsData as any;
    console.log("BB Retail Stats keys:", Object.keys(sd));

    if (sd.error_count > 0) {
      const errorMsg = sd.message_list?.map((m: { description: string }) => m.description).join(", ") || "Retail data not available";
      console.error("BB Retail Stats error:", errorMsg);
      return new Response(JSON.stringify({ error: errorMsg, statistics: null, listings: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // BB Retail API nests stats under listings_statistics array
    const lsArr = sd.listings_statistics;
    const ls = Array.isArray(lsArr) && lsArr.length > 0 ? lsArr[0] : (lsArr || {});
    console.log("BB Retail ls keys:", Object.keys(ls));

    const activeStats = ls.active_statistics || sd.active_statistics;
    const soldStats = ls.sold_statistics || sd.sold_statistics;
    const statistics = {
      mean_days_to_turn: sd.mean_days_to_turn ?? null,
      market_days_supply: sd.market_days_supply ?? null,
      active: activeStats ? {
        vehicle_count: activeStats.vehicle_count ?? 0,
        minimum_price: activeStats.minimum_price ?? 0,
        maximum_price: activeStats.maximum_price ?? 0,
        mean_price: activeStats.mean_price ?? 0,
        median_price: activeStats.median_price ?? 0,
        mean_mileage: activeStats.mean_mileage ?? 0,
        median_mileage: activeStats.median_mileage ?? 0,
      } : null,
      sold: soldStats ? {
        vehicle_count: soldStats.vehicle_count ?? 0,
        minimum_price: soldStats.minimum_price ?? 0,
        maximum_price: soldStats.maximum_price ?? 0,
        mean_price: soldStats.mean_price ?? 0,
        median_price: soldStats.median_price ?? 0,
        mean_mileage: soldStats.mean_mileage ?? 0,
        median_mileage: soldStats.median_mileage ?? 0,
      } : null,
    };

    // 2. Optionally fetch individual listings
    let listings: Array<Record<string, unknown>> = [];
    if (include_listings) {
      const listParams = new URLSearchParams({
        zipcode,
        radius_miles: String(radius_miles),
        all_trims: "false",
        duplicate_vins: "false",
        listing_type: "active",
        listings_per_page: "20",
        page_number: "1",
        order_by: "distance_to_dealer:asc",
      });
      if (vin) listParams.set("vin", vin);
      if (uvc) listParams.set("uvc", uvc);

      const listUrl = `${RETAIL_BASE}/Listings?${listParams.toString()}`;
      console.log("BB Retail Listings URL:", listUrl);

      const listRes = await fetch(listUrl, { headers: authHeaders });
      const listText = await listRes.text();
      let listData: Record<string, unknown> = {};
      try { listData = JSON.parse(listText); } catch { console.error("BB Listings parse error:", listText.substring(0, 300)); }

      if (listData.error_count === 0 && listData.listings) {
        listings = (listData.listings as Array<Record<string, unknown>>).map((l) => ({
          listing_id: l.listing_id,
          listing_type: l.listing_type,
          vin: l.vin,
          model_year: l.model_year,
          make: l.make,
          model: l.model,
          series: l.series,
          style: l.style,
          price: l.price,
          mileage: l.mileage,
          days_on_market: l.days_on_market,
          dealer_name: l.dealer_name,
          dealer_city: l.dealer_city,
          dealer_state: l.dealer_state,
          distance_to_dealer: l.distance_to_dealer,
          exterior_color: l.exterior_color,
          certified: l.certified,
          has_leather: l.has_leather,
          has_navigation: l.has_navigation,
          listing_url: l.listing_url,
        }));
      }
    }

    return new Response(JSON.stringify({ error: null, statistics, listings }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("BB Retail Listings error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch retail market data" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
