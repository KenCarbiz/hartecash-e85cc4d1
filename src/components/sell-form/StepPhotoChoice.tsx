import { Camera, Zap, Sparkles, ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

/**
 * StepPhotoChoice — gate that lets the customer pick between a quick-answer
 * path and an AI-scored photo path.
 *
 * Only renders when the dealer has enabled step_ai_photos in Lead Form admin.
 * The choice sets aiPhotoPath in SellCarForm; when `true` we route through
 * the Photos step next AND suppress the Condition step's visual damage
 * questions (the AI covers them from the uploaded photos). When `false` we
 * skip Photos entirely and show Condition in full.
 */
interface Props {
  onChoose: (useAI: boolean) => void;
}

const StepPhotoChoice = ({ onChoose }: Props) => {
  return (
    <div className="space-y-4">
      <div className="text-center max-w-md mx-auto mb-2">
        <p className="text-sm font-semibold text-card-foreground">
          How do you want to describe your car?
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Pick one. Either way you get a real cash offer in two minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Option A — quick answers (faster, fewer questions) */}
        <motion.button
          type="button"
          onClick={() => onChoose(false)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="group text-left rounded-2xl border-2 border-border hover:border-primary/40 hover:shadow-md bg-card p-5 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-card-foreground">Quick answers</span>
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">
              ~2 min
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-snug">
            Answer a few yes/no questions about condition. Done in under two minutes — no camera needed.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
            Continue <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </motion.button>

        {/* Option B — AI photos (recommended, may boost offer) */}
        <motion.button
          type="button"
          onClick={() => onChoose(true)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="group text-left rounded-2xl border-2 border-success/40 bg-success/5 hover:border-success/60 hover:shadow-md p-5 transition-all relative overflow-hidden"
        >
          <div className="absolute top-2.5 right-2.5 text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            Recommended
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center mb-3">
            <Camera className="w-5 h-5" />
          </div>
          <div className="font-bold text-card-foreground mb-1">
            Upload photos for AI scoring
          </div>
          <p className="text-sm text-muted-foreground leading-snug">
            Our AI reviews your photos and verifies actual condition. When the car looks better than self-reported,
            <strong className="text-success"> offer goes up $300–$1,500</strong> automatically.
          </p>
          <ul className="mt-3 space-y-1">
            {["Skip most condition questions", "AI grades exterior + interior from photos", "Takes ~90 seconds on phone"].map((pt) => (
              <li key={pt} className="text-[11px] text-card-foreground flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                {pt}
              </li>
            ))}
          </ul>
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-success group-hover:gap-2 transition-all">
            Start photo upload <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </motion.button>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <TrendingUp className="w-3 h-3" />
        Most customers who upload photos see a higher offer.
      </div>
    </div>
  );
};

export default StepPhotoChoice;
