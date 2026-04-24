import { useEffect } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Applies site_config colors as CSS custom properties on :root,
 * so admin color changes take effect without code deploys.
 */
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { config } = useSiteConfig();

  useEffect(() => {
    const root = document.documentElement;

    if (config.primary_color) {
      root.style.setProperty("--primary", config.primary_color);
      root.style.setProperty("--ring", config.primary_color);
      root.style.setProperty("--secondary-foreground", config.primary_color);
    }
    if (config.accent_color) {
      root.style.setProperty("--accent", config.accent_color);
    }
    if (config.success_color) {
      root.style.setProperty("--success", config.success_color);
    }

    // CTA button overrides — fall back to accent if not set
    const ctaOffer = (config as any).cta_offer_color || config.accent_color;
    const ctaAccept = (config as any).cta_accept_color || config.accent_color;
    root.style.setProperty("--cta-offer", ctaOffer);
    root.style.setProperty("--cta-accept", ctaAccept);

    // ── Admin Refresh: UI scale + text scale (Wiring Brief §5) ──
    // Only applied on the authenticated admin shell so consumer routes
    // (landing, offer, portal) stay pixel-stable.
    const isAdminRoute =
      typeof window !== "undefined" &&
      /^\/(admin|super-admin|setup|appraisal|inspect)/.test(window.location.pathname);

    const TEXT_TAG_ID = "__text-scale-override";
    const existingTag = document.getElementById(TEXT_TAG_ID);

    if (!isAdminRoute) {
      // Restore defaults on consumer routes
      (root.style as any).zoom = "";
      if (existingTag) existingTag.textContent = "";
      return;
    }

    // UI scale — zooms everything (whole admin app, including modals + slide-outs)
    const uiScale = Math.min(1.5, Math.max(0.75, Number(config.ui_scale ?? 100) / 100));
    (root.style as any).zoom = String(uiScale);

    // Text scale — inject !important overrides for every text-[NNpx] utility
    // and the named Tailwind text-* classes. The codebase uses arbitrary
    // px sizes (text-[14px]), so a single html { font-size: X% } can't
    // scale them; rewriting each used size is the only reliable path.
    const textScale = Math.min(1.5, Math.max(0.75, Number(config.text_scale ?? 100) / 100));
    let tag = existingTag as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = TEXT_TAG_ID;
      document.head.appendChild(tag);
    }
    if (textScale === 1) {
      tag.textContent = "";
    } else {
      const sizes = [9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 48, 56, 64, 72];
      const named: Record<string, number> = {
        "text-xs": 12, "text-sm": 14, "text-base": 16, "text-lg": 18,
        "text-xl": 20, "text-2xl": 24, "text-3xl": 30, "text-4xl": 36,
        "text-5xl": 48, "text-6xl": 60, "text-7xl": 72,
      };
      const rules: string[] = [];
      for (const s of sizes) {
        const esc = String(s).replace(".", "\\.");
        rules.push(`.text-\\[${esc}px\\] { font-size: ${(s * textScale).toFixed(2)}px !important; }`);
      }
      for (const [cls, px] of Object.entries(named)) {
        rules.push(`.${cls} { font-size: ${(px * textScale).toFixed(2)}px !important; }`);
      }
      tag.textContent = rules.join("\n");
    }
  }, [config]);

  return <>{children}</>;
};

export default ThemeProvider;
