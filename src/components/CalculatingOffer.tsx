import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface Props {
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  onComplete?: () => void;
  previewMode?: boolean;
}

const ANALYSIS_STEPS = [
  { label: "Scanning vehicle history…", icon: "🔍", duration: 1800 },
  { label: "Checking market demand…", icon: "📊", duration: 1600 },
  { label: "Analyzing comparable sales…", icon: "💹", duration: 1400 },
  { label: "Calculating your best price…", icon: "💰", duration: 1200 },
];

const CalculatingOffer = ({ vehicleYear, vehicleMake, vehicleModel, onComplete, previewMode }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const { config } = useSiteConfig();

  const vehicleStr = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(" ") || "Your Vehicle";

  useEffect(() => {
    if (previewMode) return;

    let elapsed = 0;
    const totalDuration = ANALYSIS_STEPS.reduce((s, step) => s + step.duration, 0);

    const interval = setInterval(() => {
      elapsed += 50;
      const pct = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(pct);

      // Determine current step
      let acc = 0;
      for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
        acc += ANALYSIS_STEPS[i].duration;
        if (elapsed < acc) {
          setCurrentStep(i);
          break;
        }
        if (i === ANALYSIS_STEPS.length - 1) setCurrentStep(i);
      }

      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setTimeout(() => onComplete?.(), 400);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [previewMode, onComplete]);

  // Preview mode: cycle through steps
  useEffect(() => {
    if (!previewMode) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % ANALYSIS_STEPS.length);
      setProgress((prev) => {
        const next = prev + 25;
        return next > 100 ? 0 : next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [previewMode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Animated gauge / radar */}
        <div className="relative w-48 h-48 mx-auto mb-8">
          {/* Outer ring */}
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle
              cx="100" cy="100" r="88"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="4"
            />
            <motion.circle
              cx="100" cy="100" r="88"
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={553}
              strokeDashoffset={553}
              animate={{ strokeDashoffset: 553 - (553 * progress) / 100 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              transform="rotate(-90 100 100)"
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentStep}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="text-4xl mb-1"
              >
                {ANALYSIS_STEPS[currentStep].icon}
              </motion.span>
            </AnimatePresence>
            <motion.span
              className="text-2xl font-bold text-foreground tabular-nums"
              key={Math.floor(progress)}
            >
              {Math.floor(progress)}%
            </motion.span>
          </div>

          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-accent/40"
              style={{
                top: "50%",
                left: "50%",
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI) / 3) * 90, 0],
                y: [0, Math.sin((i * Math.PI) / 3) * 90, 0],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Vehicle name */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-xl font-bold text-foreground mb-2"
        >
          {vehicleStr}
        </motion.h2>

        {/* Step label */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-base text-muted-foreground font-medium mb-8"
          >
            {ANALYSIS_STEPS[currentStep].label}
          </motion.p>
        </AnimatePresence>

        {/* Step indicators */}
        <div className="flex justify-center gap-6 mb-6">
          {ANALYSIS_STEPS.map((s, i) => (
            <motion.div
              key={i}
              className="flex flex-col items-center gap-1.5"
              animate={{
                opacity: i <= currentStep ? 1 : 0.3,
              }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                  i < currentStep
                    ? "bg-success/20 text-success"
                    : i === currentStep
                    ? "bg-accent/20 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}
                animate={i === currentStep ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                {i < currentStep ? "✓" : s.icon}
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Dealership name */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1 }}
          className="text-xs text-muted-foreground"
        >
          Powered by {config.dealership_name}
        </motion.p>
      </div>
    </div>
  );
};

export default CalculatingOffer;
