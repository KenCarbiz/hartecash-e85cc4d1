import { Shield } from "lucide-react";

const CTABanner = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="bg-gradient-to-br from-accent to-[hsl(0,77%,40%)] text-accent-foreground py-12 lg:py-20 px-5 text-center">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-[28px] lg:text-[38px] font-extrabold mb-4">
          Ready to Sell Your Car?
        </h2>
        <p className="text-base lg:text-lg mb-4 opacity-95">
          Join 2,400+ happy sellers. Get your cash offer today.
        </p>
        <div className="inline-flex items-center gap-2 bg-card/15 border border-card/30 rounded-full px-4 py-1.5 mb-6">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-bold">8-Day Price Guarantee — No Pressure</span>
        </div>
        <div>
          <button
            onClick={scrollToTop}
            className="inline-block px-12 py-4 bg-card text-accent rounded-lg text-[17px] font-bold shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Get My Free Offer
          </button>
        </div>
      </div>
    </section>
  );
};

export default CTABanner;
