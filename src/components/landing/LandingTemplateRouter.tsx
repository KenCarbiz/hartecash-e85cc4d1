import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteConfig, type LandingTemplate } from "@/hooks/useSiteConfig";

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
  "classic", "bold", "minimal", "elegant", "showroom",
  "cinema", "portal", "carousel", "slab", "diagonal",
  "pickup", "magazine", "circular", "motion", "mosaic",
]);

interface Props {
  /** Explicit override (admin preview). Ignores URL param and dealer config. */
  override?: LandingTemplate;
}

const LandingTemplateRouter = ({ override }: Props) => {
  const { config } = useSiteConfig();
  const [searchParams] = useSearchParams();

  // Resolution order: prop override → ?template= URL param (used by embeds) → configured default.
  const urlParam = searchParams.get("template") as LandingTemplate | null;
  const fromUrl = urlParam && VALID_TEMPLATES.has(urlParam) ? urlParam : null;
  const chosen: LandingTemplate =
    override || fromUrl || (config.landing_template as LandingTemplate) || "classic";

  const Template = templateMap[chosen] || ClassicTemplate;

  return (
    <Suspense fallback={<TemplateFallback />}>
      <Template />
    </Suspense>
  );
};

export default LandingTemplateRouter;
