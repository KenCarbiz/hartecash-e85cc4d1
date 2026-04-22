import { useState } from "react";

export default function SourceTip({
  children,
  source,
  detail,
  className = "",
}: {
  children: React.ReactNode;
  source: string;
  detail?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`relative inline cursor-help border-b border-dashed border-white/30 hover:text-white/80 transition-colors ${className}`}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[hsl(220,30%,15%)] border border-white/10 text-[11px] leading-snug text-white/70 shadow-xl z-30 w-max max-w-[min(260px,80vw)] whitespace-normal text-center pointer-events-none">
          {source}{detail && <> · <span className="text-white/50">{detail}</span></>}
        </span>
      )}
    </span>
  );
}
