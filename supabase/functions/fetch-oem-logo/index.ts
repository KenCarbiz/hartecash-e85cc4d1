const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Curated list of common automotive OEM brands with known logo sources
const BRAND_LOGOS: Record<string, string> = {
  'acura': 'https://www.carlogos.org/car-logos/acura-logo.png',
  'alfa romeo': 'https://www.carlogos.org/car-logos/alfa-romeo-logo.png',
  'audi': 'https://www.carlogos.org/car-logos/audi-logo.png',
  'bmw': 'https://www.carlogos.org/car-logos/bmw-logo.png',
  'buick': 'https://www.carlogos.org/car-logos/buick-logo.png',
  'cadillac': 'https://www.carlogos.org/car-logos/cadillac-logo.png',
  'chevrolet': 'https://www.carlogos.org/car-logos/chevrolet-logo.png',
  'chrysler': 'https://www.carlogos.org/car-logos/chrysler-logo.png',
  'dodge': 'https://www.carlogos.org/car-logos/dodge-logo.png',
  'fiat': 'https://www.carlogos.org/car-logos/fiat-logo.png',
  'ford': 'https://www.carlogos.org/car-logos/ford-logo.png',
  'genesis': 'https://www.carlogos.org/car-logos/genesis-logo.png',
  'gmc': 'https://www.carlogos.org/car-logos/gmc-logo.png',
  'honda': 'https://www.carlogos.org/car-logos/honda-logo.png',
  'hyundai': 'https://www.carlogos.org/car-logos/hyundai-logo.png',
  'infiniti': 'https://www.carlogos.org/car-logos/infiniti-logo.png',
  'jaguar': 'https://www.carlogos.org/car-logos/jaguar-logo.png',
  'jeep': 'https://www.carlogos.org/car-logos/jeep-logo.png',
  'kia': 'https://www.carlogos.org/car-logos/kia-logo.png',
  'land rover': 'https://www.carlogos.org/car-logos/land-rover-logo.png',
  'lexus': 'https://www.carlogos.org/car-logos/lexus-logo.png',
  'lincoln': 'https://www.carlogos.org/car-logos/lincoln-logo.png',
  'maserati': 'https://www.carlogos.org/car-logos/maserati-logo.png',
  'mazda': 'https://www.carlogos.org/car-logos/mazda-logo.png',
  'mercedes-benz': 'https://www.carlogos.org/car-logos/mercedes-benz-logo.png',
  'mini': 'https://www.carlogos.org/car-logos/mini-logo.png',
  'mitsubishi': 'https://www.carlogos.org/car-logos/mitsubishi-logo.png',
  'nissan': 'https://www.carlogos.org/car-logos/nissan-logo.png',
  'porsche': 'https://www.carlogos.org/car-logos/porsche-logo.png',
  'ram': 'https://www.carlogos.org/car-logos/ram-logo.png',
  'subaru': 'https://www.carlogos.org/car-logos/subaru-logo.png',
  'tesla': 'https://www.carlogos.org/car-logos/tesla-logo.png',
  'toyota': 'https://www.carlogos.org/car-logos/toyota-logo.png',
  'volkswagen': 'https://www.carlogos.org/car-logos/volkswagen-logo.png',
  'volvo': 'https://www.carlogos.org/car-logos/volvo-logo.png',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, brand, dealershipId, locationId } = await req.json();

    // Action: list — return all available brands
    if (action === 'list') {
      const brands = Object.keys(BRAND_LOGOS).sort().map(b => ({
        name: b.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
        key: b,
      }));
      return new Response(
        JSON.stringify({ success: true, brands }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: fetch — download the logo and store it in dealer-logos bucket
    if (action === 'fetch') {
      if (!brand || !dealershipId || !locationId) {
        return new Response(
          JSON.stringify({ success: false, error: 'brand, dealershipId, and locationId are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const brandKey = brand.toLowerCase().trim();
      let logoUrl = BRAND_LOGOS[brandKey];

      // If not in curated list, try Firecrawl search
      if (!logoUrl) {
        const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
        if (firecrawlKey) {
          const searchRes = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `${brand} car logo transparent PNG official`,
              limit: 5,
            }),
          });
          const searchData = await searchRes.json();
          // Try to find an image URL from results
          if (searchData.data) {
            for (const result of searchData.data) {
              const content = (result.markdown || '') + ' ' + (result.html || '');
              const imgMatch = content.match(/https?:\/\/[^\s"'<>]+\.(?:png|svg|webp)/i);
              if (imgMatch) {
                logoUrl = imgMatch[0];
                break;
              }
            }
          }
        }
      }

      if (!logoUrl) {
        return new Response(
          JSON.stringify({ success: false, error: `Could not find logo for "${brand}". Try uploading manually.` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Download the image
      const imgRes = await fetch(logoUrl);
      if (!imgRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to download logo image' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imgData = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') || 'image/png';
      const ext = contentType.includes('svg') ? 'svg' : contentType.includes('webp') ? 'webp' : 'png';
      const safeName = brandKey.replace(/[^a-z0-9]/g, '_');
      const filePath = `${dealershipId}/${locationId}/oem_${safeName}.${ext}`;

      // Upload to dealer-logos bucket
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const uploadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/dealer-logos/${filePath}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': contentType,
            'x-upsert': 'true',
          },
          body: imgData,
        }
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        console.error('Storage upload error:', err);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to save logo to storage' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const publicUrl = `${supabaseUrl}/storage/v1/object/public/dealer-logos/${filePath}?t=${Date.now()}`;

      return new Response(
        JSON.stringify({ success: true, url: publicUrl, brand: brandKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: search — search for a brand not in the curated list
    if (action === 'search') {
      if (!brand) {
        return new Response(
          JSON.stringify({ success: false, error: 'brand is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const brandKey = brand.toLowerCase().trim();
      // Check curated list first
      const found = Object.entries(BRAND_LOGOS)
        .filter(([k]) => k.includes(brandKey))
        .map(([k]) => ({
          name: k.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
          key: k,
        }));
      
      return new Response(
        JSON.stringify({ success: true, results: found }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use: list, fetch, or search' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
