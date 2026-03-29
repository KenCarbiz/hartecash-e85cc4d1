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

    const bbData = await bbRes.json();

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

    // Fetch exterior colors AND vehicle specs for each vehicle UVC via GraphQL
    const gqlFetches = vehicleList.map(async (v: Record<string, unknown>) => {
      const vUvc = v.uvc as string;
      if (!vUvc) return { colors: [], specs: {} };
      try {
        // Combined query: colors + vehicle specs
        const gqlQuery = `{
          colors(uvc:"${vUvc}" category:"Exterior Colors" country:UNITED_STATES) {
            colors { name color_list { name swatch_list } }
          }
          drilldown(uvc:"${vUvc}") {
            drilldown {
              drivetrain engine_description fuel_type transmission_description
            }
          }
        }`;
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
          return { colors: [], specs: {} };
        }
        const gqlData = await gqlRes.json();

        // Extract colors
        const categories = gqlData?.data?.colors?.colors || [];
        const exteriorCat = categories.find((c: Record<string, unknown>) =>
          ((c.name as string) || "").toLowerCase().includes("exterior")
        );
        const colorList = exteriorCat
          ? (exteriorCat.color_list || []) as Array<{ name: string; swatch_list: string[] }>
          : [];
        console.log(`Found ${colorList.length} exterior colors for UVC ${vUvc}`);
        const colors = colorList.map((c) => ({
          code: "",
          name: c.name || "",
          hex: c.swatch_list?.[0] || "",
        }));

        // Extract specs from drilldown
        const dd = gqlData?.data?.drilldown?.drilldown;
        const specs = dd ? {
          drivetrain: dd.drivetrain || "",
          engine: dd.engine_description || "",
          fuel_type: dd.fuel_type || "",
          transmission: dd.transmission_description || "",
        } : {};
        if (dd) console.log(`Vehicle specs for UVC ${vUvc}:`, JSON.stringify(specs));

        return { colors, specs };
      } catch (e) {
        console.error(`BB GraphQL fetch error for UVC ${vUvc}:`, (e as Error).message);
        return { colors: [], specs: {} };
      }
    });

    const allGqlResults = await Promise.all(gqlFetches);

    // Transform each vehicle into a comprehensive response
    const vehicles = vehicleList.map((v: Record<string, unknown>, i: number) => {
      const gql = allGqlResults[i] || { colors: [], specs: {} };
      // deno-lint-ignore no-explicit-any
      const specs = gql.specs as any;
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

      // Vehicle specs from GraphQL drilldown
      drivetrain: specs?.drivetrain || "",
      transmission: specs?.transmission || "",
      engine: specs?.engine || "",
      fuel_type: specs?.fuel_type || "",

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
    }));

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
