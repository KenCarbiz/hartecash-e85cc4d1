import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "How long does it take to get an offer?",
    a: "Most offers are generated within 2 minutes of submitting your vehicle information. Complex cases may take up to 24 hours.",
  },
  {
    q: "Do I need to bring my car to you?",
    a: "Nope! We offer free pickup at your home, office, or wherever is most convenient for you.",
  },
  {
    q: "What if I still owe money on my car?",
    a: "No problem. We handle payoffs directly with your lender and pay you the difference.",
  },
  {
    q: "Is there any obligation after I get an offer?",
    a: "Absolutely not. Our offers are no-obligation — you're free to accept, decline, or shop around.",
  },
  {
    q: "What paperwork do I need?",
    a: "Just your vehicle title, a valid ID, and your registration. We handle all the rest.",
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 px-5 bg-background">
      <h2 className="text-2xl md:text-[28px] font-extrabold text-center mb-12 text-foreground">
        Frequently Asked Questions
      </h2>
      <div className="max-w-[600px] mx-auto">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-card rounded-xl mb-3 overflow-hidden">
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
