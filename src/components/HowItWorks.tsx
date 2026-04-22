const HowItWorks = () => {
  const steps = [
    {
      num: "1",
      title: "Tell Us About Your Car",
      desc: "Enter your license plate or VIN and basic details. Takes less than 2 minutes.",
    },
    {
      num: "2",
      title: "Get Your Cash Offer",
      desc: "Receive a competitive, no-obligation offer based on real market data.",
    },
    {
      num: "3",
      title: "Get Paid & We Pick Up",
      desc: "Accept your offer, get paid on the spot, and we'll pick up your car for free.",
    },
  ];

  return (
    <section id="how-it-works" className="py-16 lg:py-20 px-5 bg-card relative overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border)/0.3)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none opacity-40" />
      
      <div className="relative">
        <div className="text-center mb-12 lg:mb-16">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-primary/70 mb-3">Simple Process</span>
          <h2 className="font-display text-2xl md:text-[28px] lg:text-[34px] font-extrabold text-card-foreground tracking-[0.04em]">
            How It Works
          </h2>
        </div>
        
        <div className="max-w-[400px] lg:max-w-5xl mx-auto lg:grid lg:grid-cols-3 lg:gap-12 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden lg:block absolute top-10 left-[16.66%] right-[16.66%] h-[2px] bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
          
          {steps.map((step, i) => (
            <div key={i} className="flex lg:flex-col lg:items-center lg:text-center gap-5 mb-10 last:mb-0 lg:mb-0 group">
              <div className="relative">
                <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-primary to-[hsl(210,100%,30%)] text-primary-foreground rounded-2xl lg:rounded-2xl flex items-center justify-center text-[28px] lg:text-[34px] font-extrabold flex-shrink-0 shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-primary/30">
                  {step.num}
                </div>
                {/* Glow ring on hover */}
                <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
              </div>
              <div>
                <h3 className="text-lg lg:text-xl font-bold mb-2 text-card-foreground">
                  {step.title}
                </h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
