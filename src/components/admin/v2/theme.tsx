/**
 * Admin V2 — sleek/minimal design-system primitives.
 *
 * V2 is being built alongside the classic admin (V1) as its eventual
 * replacement. To avoid disturbing V1, the V2 look is expressed as a
 * small set of self-contained primitives that use the Autocurb customer
 * portal palette directly (purple/teal accents, soft-gray canvas, white
 * rounded cards, generous spacing) rather than re-theming the global
 * shadcn tokens. Everything here is additive and scoped to /admin/v2.
 *
 * Palette (mirrors src/components/portal/PortalPageShell.tsx):
 *   ink      #06194A  headings / primary text
 *   muted    #53627A  secondary text
 *   line     #E6EAF0  hairline borders
 *   canvas   #F4F6FA  page background
 *   purple   #6D28D9  primary accent
 *   teal     #0D9488  secondary accent
 */
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const V2 = {
  ink: "#06194A",
  muted: "#53627A",
  subtle: "#7A879C",
  line: "#E6EAF0",
  canvas: "#F4F6FA",
  purple: "#6D28D9",
  teal: "#0D9488",
} as const;

/**
 * Suspense / lazy-load fallback used across every V2 surface. Replaces
 * the ~19 hand-copied `<div className="py-10 text-center text-sm
 * text-[#7A879C]">Loading…</div>` blocks so the muted colour and copy
 * live in exactly one place.
 */
export const Loading = ({ label = "Loading…", className = "" }: { label?: string; className?: string }) => (
  <div className={cn("py-10 text-center text-sm text-[#7A879C]", className)}>{label}</div>
);

/**
 * Calm, consistent empty-state block — optional icon, a one-line title,
 * and an optional hint. Standardises the per-page ad-hoc empty strings.
 */
export const EmptyState = ({
  icon,
  title,
  hint,
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col items-center justify-center gap-2 px-5 py-12 text-center", className)}>
    {icon && <span className="text-[#9AA6BC]">{icon}</span>}
    <p className="text-sm font-medium text-[#53627A]">{title}</p>
    {hint && <p className="text-[13px] text-[#7A879C]">{hint}</p>}
  </div>
);

/** Single canonical "not yet wired" marker for preview features. */
export const PreviewBadge = ({ children = "Soon" }: { children?: ReactNode }) => (
  <Pill tone="gray">{children}</Pill>
);

/** Animated page wrapper with a title / subtitle / actions row. */
export const PageShell = ({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="text-[24px] sm:text-[28px] font-bold leading-tight tracking-tight text-[#06194A]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-[#53627A]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {children}
  </motion.div>
);

/** Soft white card — the workhorse surface across V2. */
export const Card = ({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "rounded-2xl border border-[#E6EAF0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
      className,
    )}
  >
    {children}
  </div>
);

/** Tiny upper-case section label — quiet, structural (muted, not accent). */
export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A879C]">
    {children}
  </div>
);

type PillTone = "purple" | "teal" | "green" | "amber" | "red" | "gray";

const PILL_TONES: Record<PillTone, string> = {
  purple: "text-[#6D28D9] bg-[#EEF0FF]",
  teal: "text-[#0F766E] bg-[#E6FAF7]",
  green: "text-[#0F7A3E] bg-[#E8F8EE]",
  amber: "text-[#B45309] bg-[#FEF3E2]",
  red: "text-[#B91C1C] bg-[#FEE2E2]",
  gray: "text-[#53627A] bg-[#F4F6FA]",
};

export const Pill = ({
  tone = "gray",
  children,
  className = "",
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
      PILL_TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);

/** KPI tile used on the Command Center. */
export const StatCard = ({
  label,
  value,
  hint,
  icon,
  tone = "purple",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: PillTone;
  onClick?: () => void;
}) => {
  const iconBg: Record<PillTone, string> = {
    purple: "bg-[#EEF0FF] text-[#6D28D9]",
    teal: "bg-[#E6FAF7] text-[#0F766E]",
    green: "bg-[#E8F8EE] text-[#0F7A3E]",
    amber: "bg-[#FEF3E2] text-[#B45309]",
    red: "bg-[#FEE2E2] text-[#B91C1C]",
    gray: "bg-[#F4F6FA] text-[#53627A]",
  };
  return (
    <Card
      className={cn(
        "p-5 transition-all",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="flex w-full items-start justify-between text-left disabled:cursor-default"
      >
        <div>
          <div className="text-[12px] font-medium text-[#53627A]">{label}</div>
          <div className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-[#06194A]">
            {value}
          </div>
          {hint && <div className="mt-2 text-[12px] text-[#53627A]">{hint}</div>}
        </div>
        {icon && (
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBg[tone])}>
            {icon}
          </span>
        )}
      </button>
    </Card>
  );
};

/** Primary (filled purple) and secondary (outline) buttons. */
export const PrimaryButton = ({
  children,
  onClick,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) => (
  <button
    type={type}
    onClick={onClick}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(79,70,229,0.55)] transition hover:opacity-95 active:scale-[0.98]",
      className,
    )}
  >
    {children}
  </button>
);

export const SecondaryButton = ({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6EAF0] bg-white px-4 py-2.5 text-sm font-semibold text-[#06194A] transition hover:border-[#6D28D9]/40 hover:text-[#6D28D9] active:scale-[0.98]",
      className,
    )}
  >
    {children}
  </button>
);
