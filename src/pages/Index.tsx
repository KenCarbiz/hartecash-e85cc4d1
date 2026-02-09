import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import SellCarForm from "@/components/SellCarForm";
import HowItWorks from "@/components/HowItWorks";
import ValueProps from "@/components/ValueProps";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import CTABanner from "@/components/CTABanner";
import SiteFooter from "@/components/SiteFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <SellCarForm />
      <HowItWorks />
      <ValueProps />
      <Testimonials />
      <FAQ />
      <CTABanner />
      <SiteFooter />
    </div>
  );
};

export default Index;
