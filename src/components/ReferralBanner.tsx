import { Link } from "react-router-dom";
import { Gift } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const ReferralBanner = () => {
  const { config } = useSiteConfig();
  const dealerName = config.dealership_name || "Our Dealership";

  return (
    <section className="py-10 px-4 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1 mb-3">
          <Gift className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Referral Program</span>
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          Know Someone With a Car to Sell?
        </h3>
        <p className="text-muted-foreground text-sm md:text-base mb-5 max-w-lg mx-auto">
          Earn up to <strong className="text-foreground">$200</strong> for every friend, family member, or coworker you refer to {dealerName}. No limits — the more you share, the more you earn!
        </p>
        <Link
          to="/referral"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Gift className="w-4 h-4" />
          Learn More & Start Earning
        </Link>
      </div>
    </section>
  );
};

export default ReferralBanner;
