/**
 * CustomerFileAccentStyle — injects runtime CSS custom properties for
 * the customer-file accent gradient (header + tab indicator + buttons).
 *
 * Reads `customer_file_accent` and `customer_file_accent_2` from
 * site_config so each tenant can theme the conversation-first slide-out
 * without code changes.
 */
import { useEffect } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function CustomerFileAccentStyle() {
  const { config } = useSiteConfig();
  useEffect(() => {
    const root = document.documentElement;
    const a1 = config.customer_file_accent || "#003b80";
    const a2 = config.customer_file_accent_2 || "#005bb5";
    root.style.setProperty("--customer-file-accent", a1);
    root.style.setProperty("--customer-file-accent-2", a2);
    return () => {
      // Don't strip on unmount — colors survive tab switches and
      // re-mounts of the slide-out.
    };
  }, [config.customer_file_accent, config.customer_file_accent_2]);
  return null;
}
