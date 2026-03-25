import { Check } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";

interface HeroOffsetProps {
  side: "left" | "right";
}

const HeroOffset = ({ side }: HeroOffsetProps) => {
  const { config } = useSiteConfig();

  const benefits = [
    "Faster: Get cash in 24 hours, not weeks of meetups",
    "More Convenient: One visit, we handle all paperwork",
    "Safer: No strangers at your home or getting your personal info",
    "Privacy Protected: We never share your address, name, or phone number",
  ];

  const textContent = (
    <div className="lg:flex-1 lg:pt-8 text-center lg:text-left mb-8 lg:mb-0">
      <h1 className="text-[28px] md:text-[36px] lg:text-[48px] font-extrabold tracking-wide leading-tight mb-3 uppercase">
        {config.hero_headline || "Sell Your Car\nThe Easy Way"}
      </h1>
      <p className="text-lg lg:text-xl font-medium opacity-95 mb-6 leading-relaxed max-w-lg lg:max-w-none">
        {config.hero_subtext || "Get a top-dollar cash offer in 2 minutes. No haggling, no stress."}
      </p>

      <div className="space-y-2.5 max-w-lg mx-auto lg:mx-0">
        {benefits.map((b, i) => {
          const colonIdx = b.indexOf(":");
          const label = b.substring(0, colonIdx);
          const desc = b.substring(colonIdx + 1).trim();
          return (
            <div key={i} className="flex items-start gap-2">
              <Check className="w-5 h-5 text-success flex-shrink-0 stroke-[3] mt-0.5" />
              <span className="text-[14px] md:text-[15px] font-medium leading-snug">
                <strong>{label}:</strong> {desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const formContent = (
    <div className="lg:w-[460px] lg:flex-shrink-0">
      <SellCarForm variant="split" />
    </div>
  );

  return (
    <section className="bg-gradient-to-b from-primary to-[hsl(210,100%,36%)] text-primary-foreground relative">
      <div className="max-w-6xl mx-auto px-5 py-12 lg:py-20">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-16">
          {side === "right" ? (
            <>
              {textContent}
              {formContent}
            </>
          ) : (
            <>
              {formContent}
              {textContent}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroOffset;
