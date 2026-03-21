import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  show_in_footer: boolean;
}

const SiteFooter = () => {
  const { config } = useSiteConfig();
  const dealerName = config.dealership_name || "Our Dealership";
  const [locations, setLocations] = useState<DealerLocation[]>([]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase
        .from("dealership_locations" as any)
        .select("id, name, city, state, address, show_in_footer")
        .eq("is_active", true)
        .order("sort_order");
      if (data) setLocations(data as unknown as DealerLocation[]);
    };
    fetchLocations();
  }, []);

  return (
    <footer className="bg-[hsl(220,13%,18%)] text-primary-foreground py-10 lg:py-14 px-5">
      <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-3 lg:gap-8 text-center lg:text-left">
        <div>
          <h3 className="text-xl font-bold mb-4 opacity-90">{dealerName.toUpperCase()}</h3>
          {config.address && (
            <p className="text-sm opacity-60 mb-2">{config.address}</p>
          )}
          <p className="text-sm opacity-60">
            © {new Date().getFullYear()} {dealerName}. All rights reserved.
          </p>
        </div>
        <div className="mt-6 lg:mt-0">
          <h4 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Contact</h4>
          <div className="text-sm opacity-60 leading-relaxed space-y-1">
            {config.phone && <p>{config.phone}</p>}
            {config.email && <p>{config.email}</p>}
            {config.website_url && (
              <a href={config.website_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-90 transition-opacity block">
                {config.website_url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
          {locations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <h5 className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2">Our Locations</h5>
              <div className="text-xs opacity-50 leading-relaxed space-y-0.5">
                {locations.map((loc) => (
                  <p key={loc.id}>{loc.name} — {loc.city}, {loc.state}</p>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 lg:mt-0">
          <h4 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-3">Quick Links</h4>
          <div className="flex flex-col gap-2">
            <Link to="/my-submission" className="text-sm opacity-60 hover:opacity-90 transition-opacity">View My Offer</Link>
            <Link to="/schedule" className="text-sm opacity-60 hover:opacity-90 transition-opacity">Schedule a Visit</Link>
            <Link to="/privacy" className="text-sm opacity-60 hover:opacity-90 transition-opacity">Privacy Policy</Link>
            <Link to="/terms" className="text-sm opacity-60 hover:opacity-90 transition-opacity">Terms of Service</Link>
            <Link to="/admin/login" className="text-xs opacity-40 hover:opacity-70 transition-opacity mt-2">Admin</Link>
            <Link to="/sitemap" className="text-xs opacity-40 hover:opacity-70 transition-opacity">.</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
