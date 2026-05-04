import { useState } from "react";
import GhostScreen, { type GhostScreenKind } from "@/components/landing/GhostScreen";

const VARIANTS: { value: GhostScreenKind; label: string; recommended?: boolean }[] = [
  { value: "legacy-car",    label: "Hartecash Classic", recommended: true },
  { value: "pulse-orb",     label: "Pulse Orb" },
  { value: "sweep-arc",     label: "Sweep Arc" },
  { value: "stack-reveal",  label: "Stack Reveal" },
  { value: "card-skeleton", label: "Vehicle Card" },
];

/**
 * /preview/loader — diagnostic preview of every ghost-loader variant.
 *
 * Lets the dealer compare all five variants side-by-side, switch
 * between them, and see exactly what the customer would see at the
 * BB-lookup moment. Hartecash Classic is the default and is marked
 * with a star.
 */
const PreviewLoader = () => {
  const [active, setActive] = useState<GhostScreenKind>("legacy-car");
  const [accent, setAccent] = useState("#5B6B8A");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Loader preview
          </p>
          <h1 className="text-3xl font-bold mb-2">
            Ghost loaders
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Five variants the dealer can switch between in admin. Hartecash
            Classic is the default — the official ghost-car illustration over
            an animated dashed road. Pick a variant below to see exactly what
            the customer sees during BB lookup.
          </p>
        </header>

        {/* Active variant — full customer-context preview */}
        <div className="rounded-xl border border-border bg-card p-10 mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-6 text-center">
            Customer view — {VARIANTS.find((v) => v.value === active)?.label}
          </p>
          <GhostScreen
            kind={active}
            accent={accent}
            size="lg"
            headline="Looking up your ABC1234…"
            subhead="Pulling your vehicle details from the CT registry."
          />
        </div>

        {/* Color picker — applies to all geometric variants. The
            Hartecash Classic PNG is fixed-color; this picker affects
            everything else. */}
        <div className="mb-8 flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Accent color
          </label>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 w-14 rounded-lg border border-border cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-card font-mono text-sm w-32"
          />
          <button
            type="button"
            onClick={() => setAccent("#5B6B8A")}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
          <span className="text-xs text-muted-foreground ml-2">
            (Hartecash Classic uses the artwork's fixed colors.)
          </span>
        </div>

        {/* Picker grid — each variant gets a card with mini live preview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {VARIANTS.map((v) => {
            const isActive = active === v.value;
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => setActive(v.value)}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20"
                    : "border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40"
                }`}
              >
                <div className="aspect-[16/10] mb-2.5 rounded-md overflow-hidden border border-border/60 bg-background flex items-center justify-center">
                  <GhostScreen kind={v.value} accent={accent} size="sm" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">{v.label}</span>
                  {v.recommended && !isActive && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                      ★
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Where to set the live default: <strong>Setup · Process → Landing &amp;
          Flow → Ghost Screen</strong>. Whatever you pick there is what
          customers see during BB lookup on every flow.
        </p>
      </div>
    </div>
  );
};

export default PreviewLoader;
