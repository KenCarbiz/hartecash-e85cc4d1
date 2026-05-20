// Moto-aesthetic variant of CTABanner.
//
// Visual rules:
//   * Solid primary (navy) — NO red accent gradient, no decorative
//     blurred circles, no backdrop-blur pill
//   * Button matches the Moto form's CTA button language exactly
//     (rounded-xl, white bg, primary text, no big shadow stack)
//   * Single line of value proposition copy under the heading
//
// Scrolls to the SellFlow form anchor when clicked.
import { ArrowRight } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const CTABannerLean = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    const form = document.getElementById("sell-car-form");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const days = config.price_guarantee_days || 8;
  const dealer = config.dealership_name || "us";

  return (
    <section
      aria-labelledby="cta-heading"
      className="bg-primary text-primary-foreground py-20 lg:py-24 px-5 text-center"
    >
      <div className="max-w-3xl mx-auto">
        <h2
          id="cta-heading"
          className="text-3xl lg:text-5xl font-semibold tracking-tight mb-4"
        >
          Ready to sell your car?
        </h2>
        <p className="text-base lg:text-lg text-primary-foreground/80 mb-10 max-w-xl mx-auto">
          {days}-day locked offer. Sell to {dealer} on your schedule, no pressure.
        </p>
        <button
          onClick={scrollToForm}
          className="inline-flex items-center gap-2 px-10 py-4 bg-card text-primary rounded-xl text-base font-semibold hover:bg-card/95 transition-colors"
        >
          Get my offer
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};

export default CTABannerLean;
