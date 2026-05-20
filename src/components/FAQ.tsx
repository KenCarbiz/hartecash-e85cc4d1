import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { buildDealerFaqs } from "@/lib/dealerFaq";

const FAQ = () => {
  const { config } = useSiteConfig();
  const faqs = buildDealerFaqs(config);

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 px-5 bg-background">
      <h2 className="font-display text-2xl md:text-[28px] lg:text-[34px] font-extrabold text-center mb-12 text-foreground tracking-[0.04em]">
        Frequently Asked Questions
      </h2>
      <div className="max-w-[600px] lg:max-w-3xl mx-auto lg:columns-2 lg:gap-4">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-card rounded-xl mb-3 overflow-hidden break-inside-avoid">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full p-5 text-left text-base font-semibold text-card-foreground flex justify-between items-center hover:bg-muted/50 transition-colors"
            >
              {faq.q}
              <ChevronDown
                className={`w-5 h-5 text-accent transition-transform flex-shrink-0 ml-2 ${
                  openIndex === i ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                openIndex === i ? "max-h-[500px] pb-5 px-5" : "max-h-0"
              }`}
            >
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                {faq.a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FAQ;
