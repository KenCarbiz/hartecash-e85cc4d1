import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const DealerContactCard = () => {
  const { config } = useSiteConfig();
  const dealerName = config.dealership_name || "Our Dealership";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-2xl p-5 shadow-xl border border-border/50"
    >
      <h3 className="font-display text-card-foreground mb-3">Need Help?</h3>
      <div className="space-y-2.5 text-sm">
        <p className="text-sm font-semibold text-card-foreground mb-1">{dealerName}</p>
        {config.phone && (
          <a href={`tel:${config.phone.replace(/\D/g, "")}`} className="flex items-center gap-2.5 text-muted-foreground hover:text-accent transition-colors">
            <Phone className="w-4 h-4 text-primary flex-shrink-0" />
            <span>{config.phone}</span>
          </a>
        )}
        {config.email && (
          <a href={`mailto:${config.email}`} className="flex items-center gap-2.5 text-muted-foreground hover:text-accent transition-colors">
            <Mail className="w-4 h-4 text-primary flex-shrink-0" />
            <span>{config.email}</span>
          </a>
        )}
        {config.address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(config.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2.5 text-muted-foreground hover:text-accent transition-colors"
          >
            <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span>{config.address}</span>
          </a>
        )}
        {config.business_hours && config.business_hours.length > 0 && (
          <div className="flex items-start gap-2.5 text-muted-foreground">
            <Clock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              {config.business_hours.map((h, i) => (
                <p key={i}>{h.days}: {h.hours}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DealerContactCard;
