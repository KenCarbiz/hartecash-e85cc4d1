import { useEffect, useLayoutEffect } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Convert any color string (hex `#RRGGBB`, `#RGB`, or already-HSL like
 * `"210 50% 40%"`) into the bare HSL component triplet that our CSS
 * tokens expect (e.g. `"210 50% 40%"`). Returns the input untouched if
 * it doesn't look like a hex color.
 */
function normalizeToHslTriplet(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v.startsWith("#")) return v; // already an HSL triplet or other usable form
  let hex = v.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return v;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// localStorage key + shape for the cached brand-color set. Read
// SYNCHRONOUSLY via useLayoutEffect (before first paint) so a repeat
// visitor never sees the Harte-default blue/red flash. Mirrors the
// pattern used by LandingTemplateRouter (PR #257).
//
// Without this, on every cold load the customer saw the DEFAULTS
// colors (Harte-blue + Harte-red) painted before the React Query
// resolved and ThemeProvider's useEffect rewrote the CSS vars to the
// dealer's actual brand. Same "feels cheap" symptom as the wrong-
// template flash.
const LS_THEME_KEY = "autocurb:last_brand_theme";

interface CachedTheme {
  primary?: string | null;
  accent?: string | null;
  success?: string | null;
  ctaOffer?: string | null;
  ctaAccept?: string | null;
  ctaOfferText?: string | null;
  ctaAcceptText?: string | null;
}

function readCachedTheme(): CachedTheme | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_THEME_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as CachedTheme;
  } catch (e) {
    // Corrupt cache or storage disabled — fall through, no flash protection
    // for this visit, but next paint will be correct via the live config path.
    console.debug("ThemeProvider: cached theme read failed:", e);
  }
  return null;
}

function applyTheme(root: HTMLElement, t: CachedTheme) {
  if (t.primary) {
    root.style.setProperty("--primary", t.primary);
    root.style.setProperty("--ring", t.primary);
    root.style.setProperty("--secondary-foreground", t.primary);
  }
  if (t.accent) root.style.setProperty("--accent", t.accent);
  if (t.success) root.style.setProperty("--success", t.success);
  if (t.ctaOffer) root.style.setProperty("--cta-offer", t.ctaOffer);
  if (t.ctaAccept) root.style.setProperty("--cta-accept", t.ctaAccept);
  if (t.ctaOfferText) root.style.setProperty("--cta-offer-text", t.ctaOfferText);
  if (t.ctaAcceptText) root.style.setProperty("--cta-accept-text", t.ctaAcceptText);
}

/**
 * Applies site_config colors as CSS custom properties on :root,
 * so admin color changes take effect without code deploys.
 */
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { config, loading } = useSiteConfig();

  // ── Synchronous cached-theme paint (before first browser paint) ──
  // useLayoutEffect runs after DOM mutations but BEFORE the browser
  // composites — perfect for setting CSS vars that the just-rendered
  // tree references via var(--primary) etc.
  useLayoutEffect(() => {
    const cached = readCachedTheme();
    if (cached) applyTheme(document.documentElement, cached);
    // Empty deps: this runs exactly once on mount, BEFORE the live
    // config arrives. The live-config useEffect below takes over once
    // the query resolves.
     
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const primary = normalizeToHslTriplet(config.primary_color);
    const accent = normalizeToHslTriplet(config.accent_color);
    const success = normalizeToHslTriplet(config.success_color);

    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--ring", primary);
      root.style.setProperty("--secondary-foreground", primary);
    }
    if (accent) {
      root.style.setProperty("--accent", accent);
    }
    if (success) {
      root.style.setProperty("--success", success);
    }

    // CTA button overrides — fall back to accent if not set.
    // landing_cta_color (the unified Landing & Flow override) wins over
    // the legacy cta_offer_color / cta_accept_color pair so the dealer
    // can change one color and have it apply to the landing hero CTA,
    // the wizard's Continue / Get-my-offer buttons, AND the offer
    // page's Accept button in one place.
    const landingCtaBg = normalizeToHslTriplet((config as any).landing_cta_color);
    const ctaOffer =
      landingCtaBg ||
      normalizeToHslTriplet((config as any).cta_offer_color) ||
      accent;
    const ctaAccept =
      landingCtaBg ||
      normalizeToHslTriplet((config as any).cta_accept_color) ||
      accent;
    if (ctaOffer) root.style.setProperty("--cta-offer", ctaOffer);
    if (ctaAccept) root.style.setProperty("--cta-accept", ctaAccept);

    // CTA TEXT color override — raw value (hex/named) since these vars
    // are consumed via `color: var(--cta-offer-text)` not wrapped in
    // hsl(). Default white so existing buttons are unchanged when the
    // dealer hasn't set an override.
    const landingCtaText = (config as any).landing_cta_text_color?.trim?.() || "#FFFFFF";
    root.style.setProperty("--cta-offer-text", landingCtaText);
    root.style.setProperty("--cta-accept-text", landingCtaText);

    // Hero color overrides — applied as CSS custom properties so templates
    // can reference them via var(--hero-bg) / var(--hero-text).
    const heroBg = (config as any).hero_bg_color?.trim?.() || "";
    const heroText = (config as any).hero_text_color?.trim?.() || "";
    if (heroBg) root.style.setProperty("--hero-bg", heroBg);
    if (heroText) root.style.setProperty("--hero-text", heroText);

    // Persist the resolved set for next visit's synchronous paint.
    // Only write when the live config has actually loaded (skip while
    // the React Query is still in flight — otherwise we'd cache the
    // DEFAULTS and the flash never goes away).
    if (!loading) {
      try {
        const next: CachedTheme = {
          primary,
          accent,
          success,
          ctaOffer: ctaOffer ?? null,
          ctaAccept: ctaAccept ?? null,
          ctaOfferText: landingCtaText,
          ctaAcceptText: landingCtaText,
        };
        localStorage.setItem(LS_THEME_KEY, JSON.stringify(next));
      } catch (e) {
        console.debug("ThemeProvider: theme cache write failed:", e);
      }
    }

    // ── Admin Refresh: UI scale + text scale ──
    // Only applied on the authenticated admin shell so consumer routes
    // (landing, offer, portal) stay pixel-stable.
    //
    // ui_scale → only scales the MAIN CONTENT AREA where sections render
    //   (data-admin-main element). Top bar + sidebar stay fixed.
    // text_scale → only scales TEXT IN THE TOP BAR (data-admin-topbar
    //   element). Body text everywhere else stays its base size.
    const isAdminRoute =
      typeof window !== "undefined" &&
      /^\/(admin|super-admin|setup|appraisal|inspect)/.test(window.location.pathname);

    const TEXT_TAG_ID = "__topbar-text-scale-override";
    const existingTag = document.getElementById(TEXT_TAG_ID);

    if (!isAdminRoute) {
      (root.style as any).zoom = "";
      const main = document.querySelector("[data-admin-main]") as HTMLElement | null;
      if (main) (main.style as any).zoom = "";
      if (existingTag) existingTag.textContent = "";
      return;
    }

    // Reset any legacy global zoom that older builds applied to the root.
    (root.style as any).zoom = "";

    // UI scale → apply zoom to [data-admin-main] only.
    const uiScale = Math.min(1.5, Math.max(0.75, Number(config.ui_scale ?? 100) / 100));
    const main = document.querySelector("[data-admin-main]") as HTMLElement | null;
    if (main) (main.style as any).zoom = String(uiScale);

    // Text scale → scoped to [data-admin-topbar] descendants. Rewrites
    // text-[Npx] arbitrary sizes and named Tailwind text-* classes only
    // when nested under the top bar element.
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
        rules.push(`[data-admin-topbar] .text-\\[${esc}px\\] { font-size: ${(s * textScale).toFixed(2)}px !important; }`);
      }
      for (const [cls, px] of Object.entries(named)) {
        rules.push(`[data-admin-topbar] .${cls} { font-size: ${(px * textScale).toFixed(2)}px !important; }`);
      }
      tag.textContent = rules.join("\n");
    }
  }, [config, loading]);

  return <>{children}</>;
};

export default ThemeProvider;
