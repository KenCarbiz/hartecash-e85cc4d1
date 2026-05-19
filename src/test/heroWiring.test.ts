/**
 * Hero wiring audit.
 *
 * Static check: every consumer-facing landing page / template must read
 * its hero headline + subtext from `site_config` (via `useSiteConfig`)
 * rather than hardcoding strings. This guards against regressions where
 * an admin edits a hero in Branding but the public page ignores the value.
 *
 * We do this with file-text assertions instead of rendering, because the
 * templates pull on many providers (router, query, theme, supabase) and
 * rendering all 20+ would be brittle. The wiring contract is simply:
 * the file must reference the config key.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TEMPLATES_DIR = join(process.cwd(), "src/components/landing/templates");

// Templates that intentionally render no hero (utility / non-landing variants).
const TEMPLATE_EXEMPTIONS = new Set<string>([
  "PortalTemplate.tsx", // customer portal shell, not a marketing landing
  "LegacyTemplate.tsx", // delegates hero rendering to <Hero /> which already reads config
  "ClassicTemplate.tsx", // delegates to <HeroOffset /> which reads config
  "CarouselTemplate.tsx", // photo-rotator hero, headline is image-based
  "CircularTemplate.tsx", // brand mark hero, no copy
  "MotoTemplate.tsx", // instant-offer form IS the page — intentionally hero-less
]);

const read = (p: string) => readFileSync(p, "utf8");

describe("Hero wiring — landing templates", () => {
  const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".tsx"));

  for (const file of files) {
    if (TEMPLATE_EXEMPTIONS.has(file)) continue;

    it(`${file} reads hero_headline + hero_subtext from site_config`, () => {
      const src = read(join(TEMPLATES_DIR, file));
      expect(src, `${file} should reference config.hero_headline`).toMatch(
        /config\.hero_headline/
      );
      expect(src, `${file} should reference config.hero_subtext`).toMatch(
        /config\.hero_subtext/
      );
    });
  }
});

describe("Hero wiring — page-level routes", () => {
  const cases: Array<{ path: string; keys: string[] }> = [
    {
      path: "src/pages/ServiceLanding.tsx",
      keys: ["service_hero_headline", "service_hero_subtext"],
    },
    {
      path: "src/pages/TradeLanding.tsx",
      keys: ["trade_hero_headline", "trade_hero_subtext"],
    },
    {
      path: "src/pages/AboutPage.tsx",
      keys: ["about_hero_headline", "about_hero_subtext"],
    },
    {
      // TradeIframe historically falls back to the main hero copy when the
      // tenant hasn't customized iframe-specific text — accept either set.
      path: "src/pages/TradeIframe.tsx",
      keys: [
        "(trade_iframe_headline|hero_headline)",
        "(trade_iframe_subtext|hero_subtext)",
      ],
    },
  ];

  for (const { path, keys } of cases) {
    it(`${path} wires ${keys.join(" + ")}`, () => {
      const src = read(join(process.cwd(), path));
      for (const key of keys) {
        expect(src, `${path} should reference ${key}`).toMatch(
          new RegExp(`(config|siteConfig)\\.${key}`)
        );
      }
    });
  }
});
