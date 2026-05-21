import JourneyEngine from "./JourneyEngine";
import { buildPresetConfig, type JourneyPresetId } from "./presets";
import type { JourneyConfig, OfferDisplayMode } from "./types";

/**
 * Public entry for Moto Detailed. Resolves a config from either:
 *   - an explicit `config` override (dealer-customized journey), or
 *   - a `preset` id, or
 *   - the legacy `offerDisplayMode` shortcut (back-compat with the
 *     original SellFlow wiring).
 *
 * Presets, guardrails, and the analytics hook live next to the
 * engine — see ./presets.ts and ./analytics.ts.
 */
interface Props {
  preset?: JourneyPresetId;
  offerDisplayMode?: OfferDisplayMode;
  config?: JourneyConfig;
}

const MotoDetailedFlow = ({ preset, offerDisplayMode = "after_contact_info", config }: Props) => {
  const resolved =
    config ??
    buildPresetConfig(preset ?? (offerDisplayMode === "before_contact_info" ? "instant_offer" : "moto_detailed"));
  return <JourneyEngine config={resolved} />;
};

export default MotoDetailedFlow;
