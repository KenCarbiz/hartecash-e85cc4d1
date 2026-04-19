import Hero from "@/components/Hero";
import HeroOffset from "@/components/HeroOffset";
import SellCarForm from "@/components/SellCarForm";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { DefaultBelowFold } from "../sharedSections";

const ClassicTemplate = () => {
  const { config } = useSiteConfig();
  const layout = config.hero_layout || "offset_right";

  return (
    <>
      {layout === "offset_right" ? (
        <HeroOffset side="right" />
      ) : layout === "offset_left" ? (
        <HeroOffset side="left" />
      ) : (
        <>
          <Hero />
          <SellCarForm />
        </>
      )}
      <DefaultBelowFold />
    </>
  );
};

export default ClassicTemplate;
