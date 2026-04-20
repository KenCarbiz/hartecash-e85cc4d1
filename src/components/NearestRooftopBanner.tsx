import { useEffect, useState } from "react";
import { MapPin, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface RooftopRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  center_lat: number | null;
  center_lng: number | null;
}

interface RooftopTenantRow {
  slug: string;
  display_name: string;
  custom_domain: string | null;
  location_id: string;
}

const DISMISS_KEY = "hartecash_nearest_dismissed";

/**
 * Suggests the nearest rooftop on the corporate group hub only.
 *
 * Renders nothing when:
 *   - the page is already a specific rooftop (tenant.location_id is set)
 *   - the dealer has only one location
 *   - the customer dismissed it this session
 *   - geolocation permission is denied or unavailable
 *
 * Uses navigator.geolocation rather than IP geo so we don't ship a
 * server-side dependency. The user is asked once; falling back silently
 * if they decline preserves the funnel.
 */
const NearestRooftopBanner = () => {
  const { tenant } = useTenant();
  const [nearest, setNearest] = useState<{ tenant: RooftopTenantRow; loc: RooftopRow; distanceMi: number } | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  // Guard 1: only render on the group hub, not on a rooftop-specific page
  const isOnRooftop = !!tenant.location_id;

  useEffect(() => {
    if (isOnRooftop || dismissed) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;

    (async () => {
      // Pull all this dealer's rooftops + their tenant rows in parallel
      const [locRes, tRes] = await Promise.all([
        supabase
          .from("dealership_locations" as any)
          .select("id, name, city, state, center_lat, center_lng")
          .eq("dealership_id", tenant.dealership_id)
          .eq("is_active", true),
        supabase
          .from("tenants")
          .select("slug, display_name, custom_domain, location_id")
          .eq("dealership_id", tenant.dealership_id)
          .not("location_id", "is", null),
      ]);
      if (cancelled) return;

      const locations = ((locRes.data as unknown) as RooftopRow[]) || [];
      const rooftopTenants = ((tRes.data as unknown) as RooftopTenantRow[]) || [];

      // Need at least 2 rooftops AND at least one with own URL to be useful
      if (locations.length < 2 || rooftopTenants.length === 0) return;

      // Ask the browser for coords; bail silently if denied or slow
      const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
        const t = setTimeout(() => resolve(null), 4000);
        navigator.geolocation.getCurrentPosition(
          (pos) => { clearTimeout(t); resolve(pos.coords); },
          () => { clearTimeout(t); resolve(null); },
          { enableHighAccuracy: false, maximumAge: 1000 * 60 * 60, timeout: 4000 },
        );
      });
      if (!coords || cancelled) return;

      // Find nearest rooftop with both coords AND an own-URL tenant row
      let best: { loc: RooftopRow; tenant: RooftopTenantRow; distanceMi: number } | null = null;
      for (const loc of locations) {
        if (loc.center_lat == null || loc.center_lng == null) continue;
        const t = rooftopTenants.find((r) => r.location_id === loc.id);
        if (!t) continue;
        const d = haversineMiles(coords.latitude, coords.longitude, loc.center_lat, loc.center_lng);
        if (!best || d < best.distanceMi) best = { loc, tenant: t, distanceMi: d };
      }
      if (best && !cancelled) setNearest(best);
    })();

    return () => { cancelled = true; };
  }, [tenant.dealership_id, isOnRooftop, dismissed]);

  if (isOnRooftop || dismissed || !nearest) return null;

  const targetUrl = nearest.tenant.custom_domain
    ? `https://${nearest.tenant.custom_domain}`
    : `/locations/${nearest.tenant.slug}`;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode */ }
  };

  return (
    <div className="bg-primary/8 border-b border-primary/15 print:hidden">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <MapPin className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 text-sm">
          <span className="text-foreground">
            Looks like you're near <strong>{nearest.loc.city}{nearest.loc.state ? `, ${nearest.loc.state}` : ""}</strong> —
          </span>{" "}
          <a
            href={targetUrl}
            className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
          >
            visit {nearest.tenant.display_name}
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <span className="text-muted-foreground text-xs ml-1.5">({Math.round(nearest.distanceMi)} mi)</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Quick-and-dirty haversine in miles. Accurate enough at city scale.
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default NearestRooftopBanner;
