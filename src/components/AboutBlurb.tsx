import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Crawlable "About" blurb with citable stats.
 * Rendered as real semantic HTML so AI engines (ChatGPT, Perplexity, Google AI Overviews)
 * can extract and cite it. Visually subtle but fully readable.
 */
const AboutBlurb = () => {
  const { config } = useSiteConfig();
  const name = config.dealership_name || "Harte Auto Group";

  return (
    <section
      className="bg-muted/40 border-t border-border py-10 px-5"
      aria-label="About"
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-lg font-bold text-foreground mb-3">
          About {name}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Founded in <strong>1951</strong> in Connecticut, {name} has purchased
          over <strong>{config.stats_cars_purchased || "14,721+"}</strong>{" "}
          vehicles directly from consumers. We provide firm cash offers in under
          2 minutes, backed by an{" "}
          <strong>{config.price_guarantee_days || 8}-day price guarantee</strong>
          . Every offer includes{" "}
          <strong>free vehicle pickup</strong> and full loan-payoff handling — no
          hidden fees, no obligation.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Rated <strong>{config.stats_rating || "4.9"} out of 5</strong> across{" "}
          <strong>{config.stats_reviews_count || "2,400+"} verified reviews</strong>,
          we're one of Connecticut's most trusted car-buying services. Whether
          you're selling, trading in, or exploring your options, our process is
          designed to be faster, safer, and more convenient than private-party
          sales or national competitors.
        </p>
      </div>
    </section>
  );
};

export default AboutBlurb;
