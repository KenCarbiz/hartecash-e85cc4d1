/**
 * UI regression — landing template hero rendering.
 *
 * Renders every consumer landing template with a unique fixture for
 * `useSiteConfig`, then asserts the configured `hero_headline` and
 * `hero_subtext` are visible in the rendered DOM. This is the "did the
 * admin input actually flow into the public page" guarantee.
 *
 * We use DOM-level assertions rather than pixel screenshots because:
 *   - templates use fonts/animations that flake on visual diff
 *   - the regression class we care about is a binary one (text appears
 *     or it doesn't), which DOM assertions catch perfectly
 *   - it runs in CI without a headless browser
 *
 * Heavy children (LandingForm, sharedSections, router, supabase) are
 * mocked to no-ops so we exercise the hero shell only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// ── Mock everything heavy ─────────────────────────────────────────────
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) },
}));
vi.mock("react-router-dom", () => ({
  Link: ({ children }: any) => <>{children}</>,
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/" }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), () => {}],
}));
vi.mock("framer-motion", () => {
  const passthrough = (tag: string) => ({ children, ...rest }: any) => {
    const Tag: any = tag;
    return <Tag {...rest}>{children}</Tag>;
  };
  return {
    motion: new Proxy({}, { get: (_t, prop: string) => passthrough(prop) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useScroll: () => ({ scrollY: { onChange: () => {} } }),
    useTransform: () => 0,
  };
});
vi.mock("@/components/LandingForm", () => ({
  default: () => <div data-testid="landing-form" />,
}));
vi.mock("@/components/landing/sharedSections", () => ({
  FullBelowFold: () => <div />,
  CompactBelowFold: () => <div />,
  TrustStrip: () => <div />,
  HowItWorks: () => <div />,
  Testimonials: () => <div />,
  FAQ: () => <div />,
  Footer: () => <div />,
  AboutBlurb: () => <div />,
}));
vi.mock("@/components/landing/LandingPlateInput", () => ({
  default: () => <div data-testid="plate-input" />,
}));
vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ dealershipId: "default", locationId: null, hostname: "test" }),
}));

// useSiteConfig is the input under test — we control it per case.
const FIXTURE = {
  hero_headline: "FIXTURE_HEADLINE_XYZ",
  hero_subtext: "FIXTURE_SUBTEXT_QRS uniquely identifiable copy here.",
  hero_layout: "offset_right",
  dealership_name: "Test Motors",
  primary_color: "210 100% 25%",
  accent_color: "0 77% 50%",
  success_color: "160 84% 39%",
  logo_url: "",
  logo_white_url: "",
  phone: "555-555-5555",
  address: "1 Test Way",
  // Permissive defaults for any other field a template touches.
};

vi.mock("@/hooks/useSiteConfig", () => ({
  useSiteConfig: () => ({
    config: new Proxy(FIXTURE as any, {
      get: (target, prop: string) => (prop in target ? target[prop] : ""),
    }),
    loading: false,
  }),
}));

// ── Template discovery ────────────────────────────────────────────────
const TEMPLATES_DIR = join(process.cwd(), "src/components/landing/templates");

// Templates that don't render hero copy themselves (delegate to <Hero />,
// to <HeroOffset />, or are non-marketing variants). These are covered
// by the static heroWiring.test.ts audit instead.
const SKIP = new Set([
  "PortalTemplate.tsx",
  "LegacyTemplate.tsx",
  "ClassicTemplate.tsx",
  "CarouselTemplate.tsx",
  "CircularTemplate.tsx",
  "MotoTemplate.tsx", // instant-offer form IS the page — intentionally hero-less
]);

const templateFiles = readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith("Template.tsx") && !SKIP.has(f));

describe("Hero rendering — admin inputs flow to landing DOM", () => {
  beforeEach(() => cleanup());

  for (const file of templateFiles) {
    const name = file.replace(".tsx", "");

    it(`${name} renders hero_headline and hero_subtext from config`, async () => {
      const mod = await import(`@/components/landing/templates/${name}.tsx`);
      const Template = mod.default;
      const { container } = render(<Template />);
      const text = container.textContent || "";

      expect(
        text.includes(FIXTURE.hero_headline),
        `${name} should render config.hero_headline in the DOM`
      ).toBe(true);
      expect(
        text.includes(FIXTURE.hero_subtext),
        `${name} should render config.hero_subtext in the DOM`
      ).toBe(true);
    });
  }
});
