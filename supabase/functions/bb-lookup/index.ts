import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BB_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/UsedVehicle";
const BB_GRAPHQL = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/GraphQL";

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

    const bbText = await bbRes.text();
    if (!bbRes.ok) {
      console.error(`BB API returned ${bbRes.status}: ${bbText.substring(0, 500)}`);
      return new Response(JSON.stringify({ error: `Black Book API error (${bbRes.status})`, vehicles: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!bbText.trim()) {
      console.error("BB API returned empty response body");
      return new Response(JSON.stringify({ error: "Black Book returned empty response", vehicles: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let bbData: Record<string, unknown>;
    try {
      bbData = JSON.parse(bbText);
    } catch (parseErr) {
      console.error("BB API returned non-JSON:", bbText.substring(0, 500));
      return new Response(JSON.stringify({ error: "Black Book returned invalid data", vehicles: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check for errors
    if (bbData.error_count > 0) {
      const errorMsg = bbData.message_list?.map((m: { description: string }) => m.description).join(", ") || "Vehicle not found";
      return new Response(JSON.stringify({ error: errorMsg, vehicles: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const vehicleList = bbData.used_vehicles?.used_vehicle_list || [];
    if (vehicleList.length > 0) {
      console.log("BB raw vehicle keys:", Object.keys(vehicleList[0]).join(", "));
    }

    // Fetch exterior colors for each vehicle UVC via GraphQL + parse specs from price_includes
    const gqlFetches = vehicleList.map(async (v: Record<string, unknown>) => {
      const vUvc = v.uvc as string;
      if (!vUvc) return { colors: [] };
      try {
        const gqlQuery = `{ colors(uvc:"${vUvc}" category:"Exterior Colors" country:UNITED_STATES) { colors { name color_list { name swatch_list } } } }`;
        const gqlRes = await fetch(BB_GRAPHQL, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: gqlQuery }),
        });
        if (!gqlRes.ok) {
          console.error(`BB GraphQL returned ${gqlRes.status}`);
          return { colors: [] };
        }
        const gqlData = await gqlRes.json();
        const categories = gqlData?.data?.colors?.colors || [];
        const exteriorCat = categories.find((c: Record<string, unknown>) =>
          ((c.name as string) || "").toLowerCase().includes("exterior")
        );
        const colorList = exteriorCat
          ? (exteriorCat.color_list || []) as Array<{ name: string; swatch_list: string[] }>
          : [];
        console.log(`Found ${colorList.length} exterior colors for UVC ${vUvc}`);
        return {
          colors: colorList.map((c) => ({
            code: "",
            name: c.name || "",
            hex: c.swatch_list?.[0] || "",
          })),
        };
      } catch (e) {
        console.error(`BB GraphQL fetch error for UVC ${vUvc}:`, (e as Error).message);
        return { colors: [] };
      }
    });

    const allGqlResults = await Promise.all(gqlFetches);

    // Parse vehicle specs from style and price_includes fields
    const parseSpecs = (style: string, priceIncludes: string) => {
      const pi = (priceIncludes || "").toUpperCase();
      const st = (style || "").toUpperCase();

      // Drivetrain from style
      let drivetrain = "";
      if (st.includes("4WD") || st.includes("AWD")) drivetrain = "AWD/4WD";
      else if (st.includes("2WD") || st.includes("FWD")) drivetrain = "FWD";
      else if (st.includes("RWD")) drivetrain = "RWD";

      // Transmission from price_includes
      let transmission = "";
      if (pi.includes("AT") || pi.includes("AUTO")) transmission = "Automatic";
      else if (pi.includes("MT") || pi.includes("MANUAL")) transmission = "Manual";
      else if (pi.includes("CVT")) transmission = "CVT";

      // Engine from price_includes
      let engine = "";
      const cylMatch = pi.match(/(\d)CY/);
      if (cylMatch) engine = `${cylMatch[1]}-Cylinder`;
      if (pi.includes("TURBO") || pi.includes("TB")) engine += engine ? " Turbo" : "Turbo";
      if (pi.includes("HYBRID") || pi.includes("HY")) engine = "Hybrid " + engine;
      if (pi.includes("ELECTRIC") || pi.includes("EV")) engine = "Electric";

      // Fuel type from price_includes
      let fuel_type = "";
      if (pi.includes("DIESEL") || pi.includes("DSL")) fuel_type = "Diesel";
      else if (pi.includes("ELECTRIC") || pi.includes("EV")) fuel_type = "Electric";
      else if (pi.includes("HYBRID") || pi.includes("HY")) fuel_type = "Hybrid";
      else if (pi.includes("FLEX")) fuel_type = "Flex Fuel";
      else if (engine) fuel_type = "Gasoline";

      return { drivetrain, transmission, engine, fuel_type };
    };

    // Transform each vehicle into a comprehensive response
    const vehicles = vehicleList.map((v: Record<string, unknown>, i: number) => {
      const gql = allGqlResults[i] || { colors: [] };
      const parsedSpecs = parseSpecs((v.style as string) || "", (v.price_includes as string) || "");
      return {
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

      // Vehicle specs parsed from style/price_includes
      drivetrain: parsedSpecs.drivetrain,
      transmission: parsedSpecs.transmission,
      engine: parsedSpecs.engine,
      fuel_type: parsedSpecs.fuel_type,

      // Exterior colors from BB
      exterior_colors: gql.colors || [],

      // Mileage & regional adjustments
      mileage_adj: v.mileage_category || 0,
      regional_adj: v.regional_adjustment || 0,
      base_whole_avg: v.base_whole_avg || 0,

      // Add/deducts
      add_deduct_list: (v.add_deduct_list as Array<Record<string, unknown>> || []).map((ad) => ({
        uoc: ad.uoc,
        name: ad.name,
        auto: ad.auto,
        avg: ad.avg,
        clean: ad.clean,
        rough: ad.rough,
        xclean: ad.xclean,
      })),

      // Wholesale values
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

      // Private Party values
      private_party: {
        xclean: v.adjusted_private_party_xclean || v.private_party_xclean || 0,
        clean: v.adjusted_private_party_clean || v.private_party_clean || 0,
        avg: v.adjusted_private_party_avg || v.private_party_avg || 0,
        rough: v.adjusted_private_party_rough || v.private_party_rough || 0,
      },

      // Equipped retail price (finance value / CVO)
      finance_advance: {
        xclean: v.adjusted_finance_advance_xclean || v.finance_advance_xclean || 0,
        clean: v.adjusted_finance_advance_clean || v.finance_advance_clean || 0,
        avg: v.adjusted_finance_advance_avg || v.finance_advance_avg || 0,
        rough: v.adjusted_finance_advance_rough || v.finance_advance_rough || 0,
      },

      // Residual values
      residual_12: v.residual_12 || 0,
      residual_24: v.residual_24 || 0,
      residual_36: v.residual_36 || 0,
      residual_48: v.residual_48 || 0,

      // Recall data
      recall_count: v.recall_count || 0,
      recalls: (v.recall_list as Array<Record<string, unknown>> || []).map((r) => ({
        campaign_number: r.campaign_number || r.nhtsa_campaign_number || "",
        component: r.component || "",
        summary: r.summary || r.description || "",
      })),
    };});

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
