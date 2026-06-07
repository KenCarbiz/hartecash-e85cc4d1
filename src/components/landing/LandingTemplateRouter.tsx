import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteConfig, type LandingTemplate } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";

// ── Legacy Hartecash (the pre-audit maximalist long-scroll) ──
const LegacyTemplate   = lazy(() => import("./templates/LegacyTemplate"));

// ── 2026 sell-flow design audit (Clarity/Marquee/Velocity/Heritage) ──
const ClarityTemplate  = lazy(() => import("./templates/ClarityTemplate"));
const MarqueeTemplate  = lazy(() => import("./templates/MarqueeTemplate"));
const VelocityTemplate = lazy(() => import("./templates/VelocityTemplate"));
const HeritageTemplate = lazy(() => import("./templates/HeritageTemplate"));

// ── Instant Offer (MotoAcquire-style 8-step flow) ──
const MotoTemplate         = lazy(() => import("./templates/MotoTemplate"));
// ── Instant Offer — Detailed (premium guided 5-step journey) ──
const MotoDetailedTemplate = lazy(() => import("./templates/MotoDetailedTemplate"));

// ── Originals ──────────────────────────────────────────────────────
const ClassicTemplate  = lazy(() => import("./templates/ClassicTemplate"));
const BoldTemplate     = lazy(() => import("./templates/BoldTemplate"));
const MinimalTemplate  = lazy(() => import("./templates/MinimalTemplate"));
const ElegantTemplate  = lazy(() => import("./templates/ElegantTemplate"));
const ShowroomTemplate = lazy(() => import("./templates/ShowroomTemplate"));

// ── OEM-style ──────────────────────────────────────────────────────
const CinemaTemplate   = lazy(() => import("./templates/CinemaTemplate"));
const PortalTemplate   = lazy(() => import("./templates/PortalTemplate"));
const CarouselTemplate = lazy(() => import("./templates/CarouselTemplate"));
const SlabTemplate     = lazy(() => import("./templates/SlabTemplate"));
const DiagonalTemplate = lazy(() => import("./templates/DiagonalTemplate"));
const PickupTemplate   = lazy(() => import("./templates/PickupTemplate"));
const MagazineTemplate = lazy(() => import("./templates/MagazineTemplate"));
const CircularTemplate = lazy(() => import("./templates/CircularTemplate"));
const MotionTemplate   = lazy(() => import("./templates/MotionTemplate"));
const MosaicTemplate   = lazy(() => import("./templates/MosaicTemplate"));

const TemplateFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
  </div>
);

const templateMap: Record<LandingTemplate, React.ComponentType> = {
  // Legacy Hartecash (pre-audit maximalist look)
  legacy:   LegacyTemplate,
  // 2026 audit-recommended
  clarity:  ClarityTemplate,
  marquee:  MarqueeTemplate,
  velocity: VelocityTemplate,
  heritage: HeritageTemplate,
  // Instant Offer (MotoAcquire-style 8-step flow)
  moto:          MotoTemplate,
  moto_detailed: MotoDetailedTemplate,
  // Originals
  classic:  ClassicTemplate,
  bold:     BoldTemplate,
  minimal:  MinimalTemplate,
  elegant:  ElegantTemplate,
  showroom: ShowroomTemplate,
  cinema:   CinemaTemplate,
  portal:   PortalTemplate,
  carousel: CarouselTemplate,
  slab:     SlabTemplate,
  diagonal: DiagonalTemplate,
  pickup:   PickupTemplate,
  magazine: MagazineTemplate,
  circular: CircularTemplate,
  motion:   MotionTemplate,
  mosaic:   MosaicTemplate,
};

const VALID_TEMPLATES = new Set<LandingTemplate>([
  "legacy",
  "clarity", "marquee", "velocity", "heritage", "moto", "moto_detailed",
  "classic", "bold", "minimal", "elegant", "showroom",
  "cinema", "portal", "carousel", "slab", "diagonal",
  "pickup", "magazine", "circular", "motion", "mosaic",
]);

interface Props {
  /** Explicit override (admin preview). Ignores URL param and dealer config. */
  override?: LandingTemplate;
}

// localStorage key for the last-known template choice for this browser
// session. Read SYNCHRONOUSLY at module load so the first paint after
// a hot navigation uses the cached value instead of falling back to
// `classic` while the site_config query is in flight.
//
// Without this, the flow was:
//   1. useSiteConfig returns DEFAULTS (landing_template: "classic")
//   2. Router renders ClassicTemplate
//   3. React Query resolves ~200-500ms later
//   4. config.landing_template updates to "moto" / "clarity" / etc
//   5. Router re-renders the right template
// Result: the wrong template flashed for half a second on every cold
// load — felt cheap and confused customers who never saw the dealer's
// configured branding on the first paint.
const LS_KEY = "autocurb:last_landing_template";

const readCachedTemplate = (key: string): LandingTemplate | null => {
  try {
    const v = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (v && VALID_TEMPLATES.has(v as LandingTemplate)) return v as LandingTemplate;
  } catch (e) {
    // Private mode / disabled storage — fall through to spinner fallback.
    console.debug("LandingTemplateRouter: localStorage read blocked:", e);
  }
  return null;
};

const LandingTemplateRouter = ({ override }: Props) => {
  const { config, loading } = useSiteConfig();
  const { tenant } = useTenant();
  const [searchParams] = useSearchParams();
  // Namespace the template cache by tenant so a prior dealership's template
  // can't flash for a different dealership in the same browser.
  const lsKey = `${LS_KEY}:${tenant.dealership_id}`;

  // Resolution order:
  //   1. prop override (admin preview)
  //   2. ?template= URL param (embeds)
  //   3. live config from useSiteConfig (once loaded)
  //   4. localStorage cache from a prior visit (synchronous, no flash)
  //   5. spinner placeholder while everything else loads
  //   6. final fallback to "classic" only when truly nothing else exists
  const urlParam = searchParams.get("template") as LandingTemplate | null;
  const fromUrl = urlParam && VALID_TEMPLATES.has(urlParam) ? urlParam : null;
  const fromConfig = !loading && config.landing_template
    ? (config.landing_template as LandingTemplate)
    : null;
  const fromCache = readCachedTemplate(lsKey);

  const chosen: LandingTemplate | null =
    override || fromUrl || fromConfig || fromCache;

  // Update the cache when live config arrives so the next cold load
  // paints correct immediately. Only writes when the resolved choice
  // actually came from config (not from override/URL/cache) — that
  // way an embed-time `?template=` override doesn't pollute the
  // dealer's saved choice.
  useEffect(() => {
    if (!fromConfig) return;
    try {
      const prev = localStorage.getItem(lsKey);
      if (prev !== fromConfig) localStorage.setItem(lsKey, fromConfig);
    } catch (e) {
      console.debug("LandingTemplateRouter: localStorage write blocked:", e);
    }
  }, [fromConfig, lsKey]);

  // No resolved choice yet (first-ever visit, no URL hint, config still
  // loading) → show the spinner instead of guessing wrong. Same skeleton
  // we already use for the lazy-import Suspense boundary so the visual
  // is consistent.
  if (!chosen) {
    return <TemplateFallback />;
  }

  const Template = templateMap[chosen] || ClassicTemplate;

  return (
    <Suspense fallback={<TemplateFallback />}>
      <Template />
    </Suspense>
  );
};

export default LandingTemplateRouter;
