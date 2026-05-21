import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/* Reusable right-side slide-over panel for the customer portal.
   Desktop : slides in from the right, 420-520px wide, soft overlay.
   Mobile  : full-screen panel with pinned bottom action bar. */

type SlideOverProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: "md" | "lg" | "xl"; // 420 / 480 / 560
  footer?: ReactNode;
  children: ReactNode;
};

const WIDTH: Record<NonNullable<SlideOverProps["width"]>, string> = {
  md: "lg:max-w-[420px]",
  lg: "lg:max-w-[480px]",
  xl: "lg:max-w-[560px]",
};

export const SlideOver = ({
  open, onClose, title, subtitle, width = "lg", footer, children,
}: SlideOverProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[#06194A]/40 backdrop-blur-sm"
          />
          <motion.aside
            key="panel"
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={`fixed inset-y-0 right-0 z-50 w-full ${WIDTH[width]} bg-white shadow-2xl flex flex-col lg:rounded-l-3xl overflow-hidden`}
          >
            <div className="flex items-start justify-between gap-3 px-5 lg:px-6 pt-5 pb-4 border-b border-[#E6EAF0]">
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-[#06194A] leading-tight truncate">{title}</h3>
                {subtitle && <p className="text-[12.5px] text-[#53627A] mt-1">{subtitle}</p>}
              </div>
              <button
                aria-label="Close"
                onClick={onClose}
                className="shrink-0 w-9 h-9 rounded-lg hover:bg-[#F4F6FA] text-[#53627A] grid place-items-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-5">{children}</div>
            {footer && (
              <div className="border-t border-[#E6EAF0] bg-white px-5 lg:px-6 py-4">{footer}</div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SlideOver;
