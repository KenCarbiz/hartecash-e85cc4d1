const CTABanner = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="bg-gradient-to-br from-accent to-[hsl(0,77%,40%)] text-accent-foreground py-12 px-5 text-center">
      <h2 className="text-[28px] font-extrabold mb-4">
        Ready to Sell Your Car?
      </h2>
      <p className="text-base mb-8 opacity-95">
        Join 2,400+ happy sellers. Get your cash offer today.
      </p>
      <button
        onClick={scrollToTop}
        className="inline-block px-12 py-4 bg-card text-accent rounded-lg text-[17px] font-bold shadow-xl hover:-translate-y-0.5 transition-all"
      >
        Get My Free Offer
      </button>
    </section>
  );
};

export default CTABanner;
