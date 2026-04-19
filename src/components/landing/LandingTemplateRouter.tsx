import { lazy, Suspense } from "react";
import { useSiteConfig, type LandingTemplate } from "@/hooks/useSiteConfig";

const ClassicTemplate = lazy(() => import("./templates/ClassicTemplate"));
const VideoTemplate = lazy(() => import("./templates/VideoTemplate"));
const InventoryTemplate = lazy(() => import("./templates/InventoryTemplate"));
const TrustTemplate = lazy(() => import("./templates/TrustTemplate"));
const EditorialTemplate = lazy(() => import("./templates/EditorialTemplate"));

const TemplateFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
  </div>
);

const templateMap: Record<LandingTemplate, React.ComponentType> = {
  classic: ClassicTemplate,
  video: VideoTemplate,
  inventory: InventoryTemplate,
  trust: TrustTemplate,
  editorial: EditorialTemplate,
};

interface Props {
  /** Optional override (for the admin preview). Ignores the dealer's configured template. */
  override?: LandingTemplate;
}

const LandingTemplateRouter = ({ override }: Props) => {
  const { config } = useSiteConfig();
  const chosen: LandingTemplate = override || (config.landing_template as LandingTemplate) || "classic";
  const Template = templateMap[chosen] || ClassicTemplate;

  return (
    <Suspense fallback={<TemplateFallback />}>
      <Template />
    </Suspense>
  );
};

export default LandingTemplateRouter;
