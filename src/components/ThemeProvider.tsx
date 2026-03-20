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
  }, [config.primary_color, config.accent_color, config.success_color]);

  return <>{children}</>;
};

export default ThemeProvider;
