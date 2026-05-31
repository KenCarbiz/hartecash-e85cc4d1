import { motion } from "framer-motion";
import type { ReactNode } from "react";

/* Page header + animated container shared by every portal sub-page.
   Keeps the soft white card system, indigo accents, and the
   premium fintech spacing consistent across routes. */

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const PortalPageShell = ({ title, subtitle, actions, children }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
  >
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-[#06194A] leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-[#53627A] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
    {children}
  </motion.div>
);

/* Compact section card used across portal pages. */
export const Card = ({ className = "", children }: { className?: string; children: ReactNode }) => (
  <div className={`bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
    {children}
  </div>
);

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#6D28D9]">{children}</div>
);

export const PrimaryButton = ({
  children, onClick, className = "", type = "button",
}: { children: ReactNode; onClick?: () => void; className?: string; type?: "button" | "submit" }) => (
  <button
    type={type}
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-[#6D28D9] to-[#6D28D9] hover:opacity-95 active:scale-[0.98] transition shadow-[0_8px_20px_-10px_rgba(79,70,229,0.55)] ${className}`}
  >
    {children}
  </button>
);

export const SecondaryButton = ({
  children, onClick, className = "",
}: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold text-[#06194A] bg-white border border-[#E6EAF0] hover:border-[#6D28D9]/40 hover:text-[#6D28D9] active:scale-[0.98] transition ${className}`}
  >
    {children}
  </button>
);

export const StatusPill = ({
  tone, children,
}: { tone: "green" | "indigo" | "orange" | "red" | "gray"; children: ReactNode }) => {
  const tones: Record<string, string> = {
    green:  "text-[#0F7A3E] bg-[#E8F8EE]",
    indigo: "text-[#6D28D9] bg-[#EEF0FF]",
    orange: "text-[#B45309] bg-[#FEF3E2]",
    red:    "text-[#B91C1C] bg-[#FEE2E2]",
    gray:   "text-[#53627A] bg-[#F4F6FA]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
};
