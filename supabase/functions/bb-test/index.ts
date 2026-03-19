import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const username = Deno.env.get("BLACKBOOK_USERNAME");
  const password = Deno.env.get("BLACKBOOK_PASSWORD");
  const credentials = btoa(`${username}:${password}`);

  // Test plate lookup - using a sample plate
  const url = `https://service.blackbookcloud.com/UsedCarWS/UsedCarWS/UsedVehicle/Plate/ABC1234?state=CT&mileage=45000&template=11`;
  
  const res = await fetch(url, {
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Accept": "application/json",
    }
  });

  const data = await res.json();
  
  return new Response(JSON.stringify(data, null, 2), {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
