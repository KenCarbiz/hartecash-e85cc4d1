import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BB_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/UsedVehicle";

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
    const { lookup_type, vin, plate, state, mileage, uvc, adddeductcodes } = body;

    if (!lookup_type || (lookup_type !== "vin" && lookup_type !== "plate")) {
      return new Response(JSON.stringify({ error: "lookup_type must be 'vin' or 'plate'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (lookup_type === "vin" && !vin) {
      return new Response(JSON.stringify({ error: "VIN is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (lookup_type === "plate" && (!plate || !state)) {
      return new Response(JSON.stringify({ error: "Plate and state are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const credentials = btoa(`${username}:${password}`);

    // Build URL
    let url: string;
    if (lookup_type === "vin") {
      url = `${BB_BASE}/VIN/${encodeURIComponent(vin)}`;
    } else {
      url = `${BB_BASE}/Plate/${encodeURIComponent(plate)}`;
    }

    // Build query params - use template 11 for history-adjusted values
    const params = new URLSearchParams({ template: "11" });
    if (mileage) params.set("mileage", String(mileage));
    if (state) params.set("state", state);
    if (uvc) params.set("uvc", uvc);
    if (adddeductcodes) params.set("adddeductcodes", adddeductcodes);

    const bbRes = await fetch(`${url}?${params.toString()}`, {
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Accept": "application/json",
      }
    });

    const bbData = await bbRes.json();

    // Check for errors
    if (bbData.error_count > 0) {
      const errorMsg = bbData.message_list?.map((m: { description: string }) => m.description).join(", ") || "Vehicle not found";
      return new Response(JSON.stringify({ error: errorMsg, vehicles: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const vehicleList = bbData.used_vehicles?.used_vehicle_list || [];

    // Transform each vehicle into a simplified response
    const vehicles = vehicleList.map((v: Record<string, unknown>) => ({
      uvc: v.uvc,
      vin: v.vin,
      year: v.model_year,
      make: v.make,
      model: v.model,
      series: v.series || "",
      style: v.style || "",
      class_name: v.class_name || "",
      msrp: v.msrp || 0,
      price_includes: v.price_includes || "",

      // Add/deducts for options/equipment selection
      add_deduct_list: (v.add_deduct_list as Array<Record<string, unknown>> || []).map((ad) => ({
        uoc: ad.uoc,
        name: ad.name,
        auto: ad.auto, // Y=auto-selected, N=not, M=matched
        avg: ad.avg,
        clean: ad.clean,
        rough: ad.rough,
        xclean: ad.xclean,
      })),

      // Wholesale values (what dealer pays — basis for our offer)
      wholesale: {
        xclean: v.adjusted_whole_xclean || v.final_whole_xclean || 0,
        clean: v.adjusted_whole_clean || v.final_whole_clean || 0,
        avg: v.adjusted_whole_avg || v.final_whole_avg || 0,
        rough: v.adjusted_whole_rough || v.final_whole_rough || 0,
      },

      // Trade-in values
      tradein: {
        clean: v.adjusted_tradein_clean || v.final_tradein_clean || 0,
        avg: v.adjusted_tradein_avg || v.final_tradein_avg || 0,
        rough: v.adjusted_tradein_rough || v.final_tradein_rough || 0,
      },

      // Retail values
      retail: {
        xclean: v.adjusted_retail_xclean || v.final_retail_xclean || 0,
        clean: v.adjusted_retail_clean || v.final_retail_clean || 0,
        avg: v.adjusted_retail_avg || v.final_retail_avg || 0,
        rough: v.adjusted_retail_rough || v.final_retail_rough || 0,
      },
    }));

    // Check if discovery mode is requested
    if (body.discovery_mode) {
      const firstRaw = vehicleList[0] || {};
      const rawKeys = Object.keys(firstRaw);
      const rawSample: Record<string, unknown> = {};
      for (const key of rawKeys) {
        const val = firstRaw[key];
        if (Array.isArray(val)) {
          rawSample[key] = `[Array of ${val.length} items]`;
        } else if (typeof val === 'object' && val !== null) {
          rawSample[key] = Object.keys(val);
        } else {
          rawSample[key] = val;
        }
      }
      return new Response(JSON.stringify({ raw_field_discovery: rawSample }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: null, vehicles }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("BB Lookup error:", err);
    return new Response(JSON.stringify({ error: "Failed to look up vehicle" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
