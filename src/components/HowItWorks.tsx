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
    <section className="py-16 px-5 bg-card">
      <h2 className="text-2xl md:text-[28px] font-extrabold text-center mb-12 text-card-foreground">
        How It Works
      </h2>
      <div className="max-w-[400px] mx-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-5 mb-10 last:mb-0">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-[hsl(210,100%,36%)] text-primary-foreground rounded-full flex items-center justify-center text-[28px] font-extrabold flex-shrink-0 shadow-lg shadow-primary/30">
              {step.num}
            </div>
            <div>
              <h3 className="text-lg font-bold mb-2 text-card-foreground">
                {step.title}
              </h3>
              <p className="text-[15px] text-muted-foreground leading-relaxed">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
