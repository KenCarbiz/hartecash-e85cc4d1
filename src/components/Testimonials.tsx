import { Star } from "lucide-react";

const testimonials = [
  {
    text: "I got $3,000 more than what CarMax offered me. The process was unbelievably easy — they picked up my car from my driveway!",
    author: "Sarah M.",
    location: "Hartford, CT",
  },
  {
    text: "Sold my old Honda in under 24 hours. The offer was fair and they handled everything. Can't recommend enough!",
    author: "Mike T.",
    location: "West Hartford, CT",
  },
  {
    text: "I was skeptical at first, but they really did beat every other offer I got. Professional and fast.",
    author: "Jennifer L.",
    location: "Manchester, CT",
  },
];

const Testimonials = () => {
  return (
    <section className="py-16 px-5 bg-card">
      <h2 className="text-2xl md:text-[28px] font-extrabold text-center mb-12 text-card-foreground">
        What Our Customers Say
      </h2>
      {testimonials.map((t, i) => (
        <div
          key={i}
          className="bg-background p-6 rounded-xl mb-4 max-w-[500px] mx-auto"
        >
          <div className="flex gap-0.5 mb-3">
            {[...Array(5)].map((_, j) => (
              <Star key={j} className="w-[18px] h-[18px] fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-[15px] leading-relaxed text-foreground mb-3 italic">
            "{t.text}"
          </p>
          <p className="text-sm font-semibold text-card-foreground">{t.author}</p>
          <p className="text-[13px] text-muted-foreground">{t.location}</p>
        </div>
      ))}
    </section>
  );
};

export default Testimonials;
