import { Check, Star } from "lucide-react";

const Hero = () => {
  const benefits = [
    "No obligation — get a real offer in minutes",
    "We come to you — free pickup at your door",
    "Beat most online offers, guaranteed",
    "Safe, secure & hassle-free process",
  ];

  return (
    <section className="bg-gradient-to-b from-primary to-[hsl(210,100%,36%)] text-primary-foreground px-5 py-12 pb-16 text-center relative">
      <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-wide leading-tight mb-4 uppercase">
        Sell Your Car
        <br />
        The Easy Way
      </h1>
      <p className="text-lg font-normal opacity-95 mb-6 leading-relaxed">
        Get a top-dollar cash offer in 2 minutes. No haggling, no stress.
      </p>

      <div className="max-w-[500px] mx-auto mb-8 text-left px-5 md:px-0">
        {benefits.map((benefit, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Check className="w-6 h-6 text-success flex-shrink-0 stroke-[3]" />
            <span className="text-[15px] md:text-base font-medium leading-snug">
              {benefit}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 mt-6">
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <span className="text-xl font-bold">4.9</span>
        <span className="text-sm opacity-80">2,400+ reviews</span>
      </div>
    </section>
  );
};

export default Hero;
