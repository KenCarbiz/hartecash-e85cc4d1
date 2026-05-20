// Moto-aesthetic closing CTA — third iteration per the 3-agent
// benchmark vs MotoAcquire's "Get started with a 30-second
// valuation!" finisher.
//
// Visual:
//   * Soft-gray bg (matches MotoAcquire's bottom strip), NOT a
//     full navy block. Sits like a calm coda rather than a
//     final shout.
//   * One line of copy, one navy pill button. No subtext, no
//     decorative blurred circles, no shadow stack.
//   * Button matches the form's CTA exactly so the visual loop
//     "form → form" is unmistakable.
import { useSiteConfig } from "@/hooks/useSiteConfig";

const scrollToForm = () => {
  const form = document.getElementById("sell-car-form");
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

const CTABannerLean = () => {
  const { config } = useSiteConfig();
  // Use dealer name when configured; falls back to generic so new
  // tenants pre-onboarding still get a usable line.
  const dealerNameRaw = (config.dealership_name || "").trim();
  const headline =
    dealerNameRaw && dealerNameRaw !== "Our Dealership"
      ? `Get started with a 30-second valuation from ${dealerNameRaw.split(" ")[0]}`
      : `Get started with a 30-second valuation`;

  return (
    <section
      aria-labelledby="cta-heading"
      className="py-20 lg:py-24 px-5 border-t border-border/60"
      style={{ background: "hsl(220 14% 96%)" }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2
          id="cta-heading"
          className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground mb-8"
        >
          {headline}
        </h2>
        <button
          type="button"
          onClick={scrollToForm}
          className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:bg-primary/95 transition-colors"
        >
          Get started
        </button>
      </div>
    </section>
  );
};

export default CTABannerLean;
