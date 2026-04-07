import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { Facebook, Instagram, Youtube, MapPin, ExternalLink, Phone, Mail } from "lucide-react";

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

  const footerLocations = locations.filter(l => l.show_in_footer);

  return (
    <footer className="relative overflow-hidden">
      {/* Top accent line */}
      <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />

      {/* Main footer */}
      <div className="bg-gradient-to-b from-card to-[hsl(var(--card)/0.95)] py-14 lg:py-20 px-5 text-card-foreground">
        <div className="max-w-6xl mx-auto">
          {/* Logo + tagline row */}
          <div className="text-center mb-12 lg:mb-16">
            {config.logo_url && (
              <img
                src={config.logo_url}
                alt={dealerName}
                className="h-16 md:h-20 w-auto mx-auto mb-4 opacity-90"
              />
            )}
            <h3 className="text-xl lg:text-2xl font-bold tracking-wide">{dealerName.toUpperCase()}</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Top-dollar cash offers. No haggling, no stress. Sell your car the easy way.
            </p>
          </div>

          {/* 3-column grid */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-12 text-center lg:text-left">
            {/* Contact */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-5">Contact</h4>
              <div className="space-y-3">
                {config.phone && (
                  <a href={`tel:${config.phone.replace(/\D/g, "")}`} className="flex items-center gap-2.5 justify-center lg:justify-start text-sm font-medium hover:text-primary transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                    </div>
                    {config.phone}
                  </a>
                )}
                {config.email && (
                  <a href={`mailto:${config.email}`} className="flex items-center gap-2.5 justify-center lg:justify-start text-sm text-muted-foreground hover:text-primary transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                    </div>
                    {config.email}
                  </a>
                )}
                {config.address && (
                  <p className="flex items-start gap-2.5 justify-center lg:justify-start text-sm text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span>{config.address}</span>
                  </p>
                )}
                {config.website_url && (
                  <a href={config.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 justify-center lg:justify-start text-sm text-muted-foreground hover:text-primary transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 text-primary" />
                    </div>
                    {config.website_url.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>

              {/* Social icons */}
              {(config.facebook_url || config.instagram_url || config.youtube_url || config.tiktok_url) && (
                <div className="flex gap-2.5 mt-6 lg:justify-start justify-center">
                  {config.facebook_url && (
                    <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20">
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                  {config.instagram_url && (
                    <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20">
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {config.youtube_url && (
                    <a href={config.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20">
                      <Youtube className="w-4 h-4" />
                    </a>
                  )}
                  {config.tiktok_url && (
                    <a href={config.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20 text-xs font-bold">
                      TT
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Locations */}
            <div className="mt-10 lg:mt-0">
              {footerLocations.length > 0 && (
                <>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-5">Our Locations</h4>
                  <div className="space-y-3">
                    {footerLocations.map((loc) => (
                      <div key={loc.id}>
                        {loc.address ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.name} ${loc.address} ${loc.city} ${loc.state}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block p-3 rounded-xl hover:bg-muted/50 transition-all duration-200"
                          >
                            <p className="font-semibold text-sm text-card-foreground group-hover:text-primary transition-colors">{loc.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{loc.city}, {loc.state} ↗</p>
                          </a>
                        ) : (
                          <div className="p-3">
                            <p className="font-semibold text-sm text-card-foreground">{loc.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{loc.city}, {loc.state}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Quick Links */}
            <div className="mt-10 lg:mt-0">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-5">Quick Links</h4>
              <div className="flex flex-col gap-1">
                {[
                  { to: "/my-submission", label: "View My Offer" },
                  { to: "/schedule", label: "Schedule a Visit" },
                  { to: "/privacy", label: "Privacy Policy" },
                  { to: "/terms", label: "Terms of Service" },
                  { to: "/disclosure", label: "Offer Disclosure" },
                  { to: "/referral", label: "Referral Program 💰" },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-primary py-1.5 px-3 rounded-lg hover:bg-muted/50 transition-all duration-200"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-[hsl(var(--card)/0.8)] border-t border-border/50 py-4 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {dealerName}. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <Link to="/admin/login" className="text-[10px] text-muted-foreground/20 hover:text-muted-foreground/50 transition-opacity" aria-label="Staff portal">•</Link>
            <Link to="/sitemap" className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-opacity">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
