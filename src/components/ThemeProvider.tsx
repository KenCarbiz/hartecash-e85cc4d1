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

    // ── Admin Refresh: UI scale + text scale ──
    // Only apply to authenticated admin shell; scope by adding a class
    // and a CSS variable consumed by the admin layout.
    const isAdminRoute =
      typeof window !== "undefined" &&
      /^\/(admin|super-admin|setup|appraisal|inspect)/.test(window.location.pathname);

    const uiScale = Math.min(150, Math.max(75, config.ui_scale ?? 100)) / 100;
    const textScale = Math.min(150, Math.max(75, config.text_scale ?? 100)) / 100;

    if (isAdminRoute) {
      root.style.setProperty("--admin-ui-scale", String(uiScale));
      root.style.setProperty("--admin-text-scale", String(textScale));
      root.classList.add("admin-scaled");
    } else {
      root.style.removeProperty("--admin-ui-scale");
      root.style.removeProperty("--admin-text-scale");
      root.classList.remove("admin-scaled");
    }
  }, [config]);

  return <>{children}</>;
};

export default ThemeProvider;
