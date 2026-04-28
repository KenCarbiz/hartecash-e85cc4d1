import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeftRight } from "lucide-react";

/**
 * BeforeAfterSlider — drag a vertical divider to compare the dealer's
 * vanilla site (left) with the Autocurb-enabled site (right). The
 * "before" is just the screenshot. The "after" is the same screenshot
 * with the active overlay assets layered on top.
 *
 * Uses CSS clip-path on the right pane so the divider position is the
 * single source of truth — no DOM duplication, no React re-mounts on
 * drag (smooth even with heavy overlays).
 *
 * Props:
 *   beforeImageSrc — the raw screenshot URL.
 *   afterContent   — the same image PLUS overlays. The caller renders
 *                    its own children (full asset stack) inside.
 */

interface Props {
  beforeImageSrc: string;
  afterContent: React.ReactNode;
}

const BeforeAfterSlider = ({ beforeImageSrc, afterContent }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50); // % from left
  const [dragging, setDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  // Pointer events cover mouse + touch + pen in one handler; modern
  // browsers route them all through PointerEvent.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => handleMove(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, handleMove]);

  return (
    <div
      ref={containerRef}
      className="relative bg-slate-100 select-none"
      style={{ aspectRatio: "1280 / 800" }}
    >
      {/* BEFORE — full-frame, raw screenshot */}
      <img
        src={beforeImageSrc}
        alt="Dealer site (before)"
        className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />

      {/* AFTER — the same screenshot + overlays, clipped to the right of the divider.
          inset clip-path: clip everything LEFT of the divider position. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        {afterContent}
      </div>

      {/* Pill labels — fade as the divider passes them */}
      <div
        className="absolute top-3 left-3 bg-slate-900/80 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded pointer-events-none transition-opacity"
        style={{ opacity: position > 15 ? 1 : 0 }}
      >
        Before
      </div>
      <div
        className="absolute top-3 right-3 bg-blue-600/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded pointer-events-none transition-opacity"
        style={{ opacity: position < 85 ? 1 : 0 }}
      >
        After (Autocurb)
      </div>

      {/* The drag handle — vertical line + circle in the middle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          aria-label="Drag to compare before and after"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center cursor-ew-resize hover:scale-110 transition-transform pointer-events-auto"
        >
          <ArrowLeftRight className="w-4 h-4 text-slate-700" />
        </button>
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
