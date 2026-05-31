import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  showArrow?: boolean;
}

/**
 * The single CTA used across Moto Detailed steps. Purple, calm,
 * never the only button on screen but always the obvious one.
 */
const PrimaryCTA = ({ children, showArrow = true, className, ...rest }: Props) => (
  <button
    {...rest}
    className={cn(
      "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--cta-offer))] px-6 py-3.5 text-base font-medium text-[color:var(--cta-offer-text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all hover:opacity-95 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:opacity-100 disabled:shadow-none sm:w-auto sm:min-w-[200px]",
      className,
    )}
  >
    {children}
    {showArrow && <ArrowRight className="h-4 w-4" />}
  </button>
);

export default PrimaryCTA;
