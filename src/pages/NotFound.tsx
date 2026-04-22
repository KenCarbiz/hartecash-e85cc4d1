import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SEO from "@/components/SEO";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const NotFound = () => {
  const { config } = useSiteConfig();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={`Page Not Found | ${config.dealership_name}`}
        description="The page you're looking for doesn't exist. Get a cash offer for your car in 2 minutes."
        path="/404"
        noindex
      />
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-5 py-20">
        <div className="text-center max-w-md">
          <p className="text-6xl font-extrabold text-primary mb-2">404</p>
          <h1 className="font-display text-2xl font-bold text-foreground mb-3">
            Page Not Found
          </h1>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/#sell-car-form">Get My Offer</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default NotFound;
