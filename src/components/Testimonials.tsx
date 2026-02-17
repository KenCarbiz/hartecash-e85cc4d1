import { useState, useEffect } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const testimonials = [
  {
    text: "I got $3,000 more than what CarMax offered me. The process was unbelievably easy — they picked up my car from my driveway!",
    author: "Sarah M.",
    location: "Hartford, CT",
    vehicle: "2019 Toyota RAV4",
  },
  {
    text: "Sold my old Honda in under 24 hours. The offer was fair and they handled everything. Can't recommend enough!",
    author: "Mike T.",
    location: "West Hartford, CT",
    vehicle: "2017 Honda Civic",
  },
  {
    text: "I was skeptical at first, but they really did beat every other offer I got. Professional and fast.",
    author: "Jennifer L.",
    location: "Manchester, CT",
    vehicle: "2020 Ford Escape",
  },
  {
    text: "No surprises, no pressure. They gave me a number, I said yes, and I had my check in 20 minutes.",
    author: "David R.",
    location: "Glastonbury, CT",
    vehicle: "2018 Chevy Malibu",
  },
];

const Testimonials = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const go = (dir: number) => {
    setDirection(dir);
    setCurrent((c) => (c + dir + testimonials.length) % testimonials.length);
  };

  const t = testimonials[current];

  return (
    <section className="py-16 px-5 bg-card overflow-hidden">
      <h2 className="text-2xl md:text-[28px] lg:text-[34px] font-extrabold text-center mb-3 text-card-foreground">
        What Our Customers Say
      </h2>
      <p className="text-center text-sm text-muted-foreground mb-10">
        Join thousands of happy sellers across Connecticut
      </p>

      {/* Mobile: carousel */}
      <div className="lg:hidden max-w-[500px] mx-auto relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            initial={{ x: direction * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -direction * 60, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-background p-6 rounded-xl"
          >
            <div className="flex gap-0.5 mb-3">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-[18px] h-[18px] fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-[15px] leading-relaxed text-foreground mb-4 italic">
              "{t.text}"
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-card-foreground">{t.author}</p>
                <p className="text-[13px] text-muted-foreground">{t.location}</p>
              </div>
              {t.vehicle && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                  {t.vehicle}
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-4 mt-5">
          <button onClick={() => go(-1)} className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors" aria-label="Previous testimonial">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }} className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-accent w-5" : "bg-border"}`} aria-label={`Go to testimonial ${i + 1}`} />
            ))}
          </div>
          <button onClick={() => go(1)} className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors" aria-label="Next testimonial">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Desktop: grid */}
      <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {testimonials.map((t, i) => (
          <div key={i} className="bg-background p-6 rounded-xl">
            <div className="flex gap-0.5 mb-3">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-[18px] h-[18px] fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-[15px] leading-relaxed text-foreground mb-4 italic">
              "{t.text}"
            </p>
            <div>
              <p className="text-sm font-semibold text-card-foreground">{t.author}</p>
              <p className="text-[13px] text-muted-foreground">{t.location}</p>
              {t.vehicle && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium mt-2 inline-block">
                  {t.vehicle}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;
