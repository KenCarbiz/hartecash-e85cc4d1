import { motion } from "framer-motion";

interface Props {
  total: number;
  activeIndex: number;
  title: string;
}

/**
 * Mobile top progress strip. No side rail on mobile — one task at a time.
 */
const MobileStepper = ({ total, activeIndex, title }: Props) => {
  const pct = ((activeIndex + 1) / total) * 100;
  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          Step {activeIndex + 1} of {total}
        </span>
        <span className="font-medium text-zinc-700">{title}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full bg-[hsl(262_83%_58%)]"
        />
      </div>
    </div>
  );
};

export default MobileStepper;
