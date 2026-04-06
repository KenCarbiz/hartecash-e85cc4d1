import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { MapPin, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

interface LocationOption {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  oem_logo_urls: string[];
}

/**
 * After an offer is generated, lets the customer pick which
 * location to visit — only for multi-location dealerships within
 * the SAME tenant. Single-location dealers skip this entirely.
 */
const PostOfferStorePicker = ({ onSelected }: { onSelected: (locationId: string) => void }) => {
  const [searchParams] = useSearchParams();
  const { tenant } = useTenant();
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(searchParams.get("store"));

  useEffect(() => {
    // If store already locked via embed param, skip
    if (searchParams.get("store")) {
      setLoading(false);
      return;
    }

    supabase
      .from("dealership_locations" as any)
      .select("id, name, city, state, address, oem_logo_urls, show_in_inspection")
      .eq("dealership_id", tenant.dealership_id)
      .eq("is_active", true)
      .eq("temporarily_offline", false)
      .order("sort_order")
      .then(({ data }) => {
        const locs = ((data as any[]) || []).filter((l: any) => l.show_in_inspection !== false) as LocationOption[];
        setLocations(locs);
        // Auto-select if only 1 location
        if (locs.length === 1) {
          setSelected(locs[0].id);
          onSelected(locs[0].id);
        }
        setLoading(false);
      });
  }, [tenant.dealership_id, searchParams, onSelected]);

  // Already locked or single location — render nothing
  if (loading || selected || locations.length <= 1) return null;

  const handleSelect = (id: string) => {
    setSelected(id);
    onSelected(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-6"
    >
      <p className="text-sm font-semibold text-card-foreground mb-1">Choose your inspection location</p>
      <p className="text-xs text-muted-foreground mb-3">Select the store you'd like to visit</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => handleSelect(loc.id)}
            className="group flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:shadow-md transition-all text-left"
          >
            {loc.oem_logo_urls?.length > 0 ? (
              <div className="flex items-center gap-1 shrink-0">
                {loc.oem_logo_urls.slice(0, 4).map((url, i) => (
                  <img key={i} src={url} alt="" className="h-8 w-auto object-contain" />
                ))}
              </div>
            ) : (
              <MapPin className="w-6 h-6 text-primary/60 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                {loc.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {loc.address || `${loc.city}, ${loc.state}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default PostOfferStorePicker;
