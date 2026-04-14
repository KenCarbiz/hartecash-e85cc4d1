import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { CheckCircle, ArrowRight } from "lucide-react";

interface SlideToAcceptProps {
  onAccept: () => void;
  label?: string;
}

const SlideToAccept = ({ onAccept, label = "Slide to Accept" }: SlideToAcceptProps) => {
  const [accepted, setAccepted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  const getMaxX = () => {
    if (!containerRef.current) return 250;
    return containerRef.current.offsetWidth - 64;
  };

  const bgOpacity = useTransform(x, [0, 200], [0.3, 1]);
  const textOpacity = useTransform(x, [0, 100], [1, 0]);
  // Hoisted out of JSX so all hooks run unconditionally (rules-of-hooks)
  const fillScaleX = useTransform(x, [0, 300], [0.15, 1]);

  const handleDragEnd = () => {
    const maxX = getMaxX();
    if (x.get() > maxX * 0.7) {
      animate(x, maxX, { type: "spring", stiffness: 300, damping: 30 });
      setAccepted(true);
      setTimeout(onAccept, 400);
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    }
  };

  if (accepted) {
    return (
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.02, 1] }}
        className="relative h-16 rounded-2xl bg-success flex items-center justify-center gap-2 overflow-hidden"
      >
        <CheckCircle className="w-6 h-6 text-success-foreground" />
        <span className="text-success-foreground font-bold text-lg">Accepted!</span>
      </motion.div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-16 rounded-2xl overflow-hidden select-none"
      style={{ backgroundColor: "hsl(var(--cta-accept) / 0.15)" }}
    >
      {/* Animated fill */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          backgroundColor: "hsl(var(--cta-accept))",
          opacity: bgOpacity,
          originX: 0,
          scaleX: fillScaleX,
        }}
      />

      {/* Label text */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none"
        style={{ opacity: textOpacity }}
      >
        <span className="text-card-foreground font-semibold text-sm tracking-wide pl-12">
          {label}
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground animate-pulse" />
      </motion.div>

      {/* Draggable thumb */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 300 }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="absolute left-1 top-1 bottom-1 w-14 rounded-xl cursor-grab active:cursor-grabbing flex items-center justify-center z-10 shadow-lg"
        whileTap={{ scale: 0.95 }}
      >
        <div
          className="w-full h-full rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "hsl(var(--cta-accept))" }}
        >
          <ArrowRight className="w-6 h-6 text-white" />
        </div>
      </motion.div>
    </div>
  );
};

export default SlideToAccept;
