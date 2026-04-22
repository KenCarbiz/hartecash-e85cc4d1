import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { MapPin, Clock, CalendarCheck, Search, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LocationCard {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  oem_logo_urls: string[];
  corporate_logo_url: string | null;
}

const VISIT_OPTIONS = [
  { id: "today", label: "Today", icon: Zap, description: "I'm ready now" },
  { id: "this_week", label: "This Week", icon: CalendarCheck, description: "In the next few days" },
  { id: "exploring", label: "Just Exploring", icon: Search, description: "Getting my offer first" },
] as const;

const StoreSelector = ({ children }: { children: React.ReactNode }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenant } = useTenant();
  const { config } = useSiteConfig();
  const [locations, setLocations] = useState<LocationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string | null>(
    searchParams.get("store")
  );
  const [showTiming, setShowTiming] = useState(false);
  const [pendingStoreId, setPendingStoreId] = useState<string | null>(null);

  const dealershipId = tenant.dealership_id;

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from("dealership_locations" as any)
        .select("id, name, city, state, address, oem_logo_urls, corporate_logo_url, show_in_inspection")
        .eq("dealership_id", dealershipId)
        .eq("is_active", true)
        .eq("temporarily_offline", false)
        .order("sort_order");

      const locs = ((data as any[]) || []).filter((l: any) => l.show_in_inspection !== false) as LocationCard[];
      setLocations(locs);
      setLoading(false);
    };
    fetchLocations();
  }, [dealershipId]);

  if (loading) return <>{children}</>;
  if (selectedStore || locations.length <= 1) return <>{children}</>;

  const handleStoreClick = (locationId: string) => {
    setPendingStoreId(locationId);
    setShowTiming(true);
  };

  const handleTimingSelect = (timing: string) => {
    if (!pendingStoreId) return;
    setSelectedStore(pendingStoreId);
    setSearchParams((prev) => {
      prev.set("store", pendingStoreId);
      prev.set("visit", timing);
      return prev;
    });
  };

  const dealerName = config.dealership_name || "Our Dealership";
  const selectedLocation = locations.find(l => l.id === pendingStoreId);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-4xl mx-auto w-full"
      >
        {config.logo_url && (
          <img
            src={config.logo_url}
            alt={dealerName}
            className="h-16 md:h-20 w-auto mx-auto mb-6 object-contain"
          />
        )}

        <AnimatePresence mode="wait">
          {!showTiming ? (
            <motion.div
              key="store-picker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -40 }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Choose Your Store
              </h2>
              <p className="text-muted-foreground mb-8 text-sm md:text-base">
                Select the {dealerName} location you'd like to work with
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
                {locations.map((loc) => (
                  <motion.button
                    key={loc.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleStoreClick(loc.id)}
                    className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-xl transition-all duration-200 text-center min-h-[180px]"
                  >
                    {/* OEM logos or pin icon */}
                    {loc.oem_logo_urls && loc.oem_logo_urls.length > 0 ? (
                      <div className="flex items-center justify-center gap-3 h-16">
                        {loc.oem_logo_urls.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Brand ${i + 1}`}
                            className="h-12 w-auto object-contain"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="h-16 flex items-center justify-center">
                        <MapPin className="w-10 h-10 text-primary/60" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <h3 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">
                        {loc.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {loc.address ? loc.address : `${loc.city}, ${loc.state}`}
                      </p>
                    </div>

                    <span className="mt-auto text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Select this store →
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="timing-picker"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto"
            >
              <button
                onClick={() => setShowTiming(false)}
                className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 transition-colors"
              >
                ← Back to stores
              </button>

              {selectedLocation && (
                <div className="flex items-center justify-center gap-2 mb-2 text-primary">
                  <MapPin className="w-4 h-4" />
                  <span className="font-semibold text-sm">{selectedLocation.name}</span>
                </div>
              )}

              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                When are you looking to visit?
              </h2>
              <p className="text-muted-foreground mb-8 text-sm md:text-base">
                This helps us prepare the best experience for you
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {VISIT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <motion.button
                      key={opt.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleTimingSelect(opt.id)}
                      className="group flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-xl transition-all duration-200 text-center min-h-[160px]"
                    >
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
                          {opt.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default StoreSelector;
