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
  }, [config]);

  return <>{children}</>;
};

export default ThemeProvider;
