import SellFlow from "@/pages/SellFlow";

/**
 * "Instant Offer" landing template — the MotoAcquire-style 8-step
 * appraisal flow. Renders the same SellFlow component that's
 * mounted at /sell, so a dealer who picks this template gets the
 * full flow on their root page (/) without needing to redirect.
 *
 * The flow is responsive on its own (MotoShell), respects
 * ?embed=true to strip its top + disclosure bars when iframed,
 * and reads pricing_reveal_mode + landing_cta_color from the
 * tenant's site_config + offer_settings.
 */
const MotoTemplate = () => <SellFlow />;

export default MotoTemplate;
