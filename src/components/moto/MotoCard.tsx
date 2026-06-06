import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The thin-bordered white card that contains a single step's
 * inputs (matches the MotoAcquire visual pattern).
 */
const MotoCard = ({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) => (
  <section
    className={cn(
      "w-full rounded-[12px] border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
      className,
    )}
  >
    {title ? (
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">{title}</h2>
    ) : null}
    {children}
  </section>
);

export default MotoCard;
