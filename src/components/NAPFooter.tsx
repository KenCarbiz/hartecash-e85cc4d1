// NAP (Name / Address / Phone) footer — a semantic <address> block
// that gives Google Local + Bing Places + Apple Maps a crawlable
// anchor for the dealer's business identity. Required for local-pack
// ranking; the page had zero of it before.
//
// All fields are per-tenant via site_config. Rendered ONLY when we
// have at least a name + one of (address | phone) — otherwise we'd
// be emitting a placeholder NAP that hurts more than it helps.
//
// Design intent: low-key, restrained. Sits at the very bottom of the
// landing chrome on desktop AND inside the mobile DefaultBelowFold
// so mobile-first indexing picks it up. No decorative noise.
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

const NAPFooter = () => {
  const { config } = useSiteConfig();
  const name = (config.dealership_name || "").trim();
  const hasContact = !!(config.address || config.phone);
  if (!name || name === "Our Dealership" || !hasContact) return null;

  return (
    <section
      aria-labelledby="nap-heading"
      className="bg-card border-t border-border/60"
    >
      <div className="max-w-3xl mx-auto px-5 py-12 lg:py-16">
        <h2
          id="nap-heading"
          className="text-2xl font-semibold tracking-tight text-foreground mb-6"
        >
          Visit {name}
        </h2>

        <address className="not-italic text-[15px] leading-relaxed text-muted-foreground space-y-3">
          {config.address ? (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-1 shrink-0 text-primary" aria-hidden />
              <span className="text-foreground">{config.address}</span>
            </div>
          ) : null}

          {config.phone ? (
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 mt-1 shrink-0 text-primary" aria-hidden />
              <a
                href={`tel:${config.phone.replace(/[^\d+]/g, "")}`}
                className="text-foreground hover:text-primary transition-colors"
              >
                {config.phone}
              </a>
            </div>
          ) : null}

          {config.email ? (
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 mt-1 shrink-0 text-primary" aria-hidden />
              <a
                href={`mailto:${config.email}`}
                className="text-foreground hover:text-primary transition-colors"
              >
                {config.email}
              </a>
            </div>
          ) : null}

          {Array.isArray(config.business_hours) && config.business_hours.length > 0 ? (
            <div className="flex items-start gap-3 pt-1">
              <Clock className="w-4 h-4 mt-1 shrink-0 text-primary" aria-hidden />
              <ul className="space-y-0.5">
                {config.business_hours.map((row, i) => (
                  <li key={i} className="flex gap-3 text-foreground">
                    <span className="font-medium w-20 shrink-0">{row.days}</span>
                    <span>{row.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </address>
      </div>
    </section>
  );
};

export default NAPFooter;
