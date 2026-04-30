import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import QuickOfferForm from "@/components/QuickOfferForm";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const QuickOfferPage = () => {
  const { config } = useSiteConfig();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="max-w-3xl mx-auto px-5 pt-6 pb-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {config.dealership_name || "Home"}
        </Link>
      </div>
      <div className="px-5 pb-12">
        <QuickOfferForm leadSource="quick-offer-page" />
      </div>
    </div>
  );
};

export default QuickOfferPage;
