# Sell-Your-Car Flow — Design Audit & Strategy

*Compiled May 2026. Synthesis of a research pass against CarMax, Carvana, SellMyCar.com, sellmyride.com (the Ingersoll/Danbury deployment is a SellMyRide skin), KBB Instant Cash Offer, AccuTrade, TradePending, Roadster, GiveMeTheVin.*

> **Methodology note.** Most consumer-auto domains 403 against direct fetch — observations are reconstructed from secondary walkthroughs (iSeeCars, CarEdge, Proximity Lab, Figma case study), vendor marketing pages, and 2024–2026 press releases. Where a fact is from a single source it's flagged.

---

## Headline finding: the Ingersoll/Danbury flow is a SellMyRide deployment

`ingersoll.sellmyride.com`, `sellyourcartoingersoll.com`, and `ingersollautoofdanbury.com/Sell-Your-Car` are three skins of the same vendor product — **SellMyRide.com**. Other dealers on the same engine: FJ Mercedes, Germain Lexus, Bellingham Ford, Hall Auto. Same flow underneath, dealer-customized cover.

This is the SaaS competitor most directly in Autocurb's lane. The "mom-and-pop" feeling on current dealer flows is largely the SellMyRide pattern: the vendor ships a clean shell, the dealer adds their logo + address + hours block + "About us" copy on top of it, and the result drifts toward dealer-y. Same trap waiting for Autocurb if the templates don't enforce constraints.

---

## What the leaders dropped from their landing pages in the last 24 months

The "delete this" list is more informative than the "do this" list. Visible across Carvana, CarMax, KBB, AccuTrade vs. their 2022–2023 layouts:

| Removed from above the fold | Why |
|---|---|
| Hero stock photo of a generic car | Filler — the form is the value |
| "Why sell to us" wall of icons | Compressed to 3-step strip OR dropped on mobile |
| Long FAQ list | Now below fold or accordion-only |
| Press / "as seen on" logo strips | Credibility crutch — signals "no one knows us" |
| Phone number as primary CTA | Form is the CTA. Phone is small, tertiary |
| Dealer hours / address / map embed | Footer at most, never above fold |
| Testimonial blocks above the form | Carvana keeps minimal ones, below fold only |
| Verbose "Step 1 of 5" progress bars | Now dots or "1/5" only |
| **Required email/phone/name before any value is shown** | Single biggest dealer-y mistake. Collect AFTER the offer. |

That last one is the dealer-y tell that kills conversion. Current Autocurb's `StepFinalize` is in the wrong position — should be after `StepGetOffer`, not before.

---

## The pattern that wins in 2026

1. **License plate + state is the first input, not VIN.** Mobile-friendlier, less typo-prone, higher start-rate.
2. **The form card IS the hero.** No stock car photo competing with it.
3. **Wizard or single-progressive-page beats long forms.** Carvana wizard, AccuTrade single-progressive page — both work, both crush traditional dealer trade-in forms.
4. **Distinct "we found your car" confirmation step.** Y/M/M + trim selector. Photo only if a confident match — wrong photo destroys trust faster than no photo.
5. **Branded compute reveal at the offer.** Carvana's ~30s "calculating" pause is by design — the math is instant, but the pause makes the dollar amount feel earned. **This is where the running-car animation belongs.**
6. **Marketing copy disappears the moment the customer engages.** 3-step explainer / FAQ live above and below the landing form, but the *flow itself* is single-column, no nav, no rails.
7. **Mobile is the canonical layout.** Desktop = centered card with breathing room. Design mobile-first or lose.

---

## The four flow templates

These slot into `src/components/landing/templates/`. Each is a different above-the-fold + transition + flow recipe — not a color swap. All four share the same wizard engine underneath.

### 1 — Clarity (Apple-minimal white)

| | |
|---|---|
| **Above the fold** | Single centered card on plain white. 56–72px display headline ("Sell your car in 2 minutes."). One field: plate + tiny state dropdown. CTA: "Get my offer." Dealer logo at 24px top-left. Nothing else. |
| **Palette** | `#FFFFFF` bg · `#0A0A0A` text · `#1D1D1F` headlines · `#0071E3` (or dealer brand) · `#F5F5F7` input bg |
| **Hero** | No photo. The form IS the hero. Massive negative space. |
| **Transition** | Form submit fades landing chrome to white over 200ms; wizard slides in from right |
| **Loader** | Thin horizontal progress line. No running car. |
| **For** | Premium import single-rooftops, EV dealers, Tesla-adjacent / design-literate buyers |

### 2 — Marquee (premium dark / luxury)

| | |
|---|---|
| **Above the fold** | Full-bleed near-black hero. Dealer wordmark large top-center. Serif headline ("A precise valuation. Within minutes."). Charcoal form card with gold-edged input. CTA: "Begin appraisal." One trust line: "Trusted by [Dealer] since 1953." |
| **Palette** | `#0F0F12` bg · `#FFFFFF` text · `#C9A96E` brass accent · `#2A2A2E` cards · `#9A9A9F` muted |
| **Hero** | Optional 8% silhouette of a luxury car behind the form. No stock photos. |
| **Transition** | Brand chrome dissolves upward; wizard fades in centered. Slow elegant easing (350ms cubic-bezier) |
| **Loader** | Slow brass progress arc rotating |
| **For** | BMW, Audi, Lexus, Porsche, Mercedes single-rooftops; family-owned luxury groups |

### 3 — Velocity (conversion-tuned, Carvana-style)

| | |
|---|---|
| **Above the fold** | Bright brand-blue gradient hero. White form card centered with 3-field stack: plate, state, ZIP. CTA: "Get real offer" in saturated yellow `#FFC700` for ruthless contrast. One social-proof line + tiny 3-step chip strip. Nothing else. |
| **Palette** | `#0066CC` primary · `#00A6E6` gradient stop · `#FFC700` CTA only · `#0A1F33` text · `#FFFFFF` cards |
| **Hero** | Gradient + form. Optional small line-art car bottom-right corner. |
| **Transition** | Hard cut to wizard with thin progress bar at top. Speed signals competence here. |
| **Loader** | **Use the running-car animation here.** Fast brand-blue car, looped, on white. Plays during the 15s offer compute. |
| **For** | Mass-market multi-rooftops, mainstream domestics (Chevy, Ford, Hyundai), volume dealers |

### 4 — Heritage (storytelling / family dealer)

| | |
|---|---|
| **Above the fold** | Two-column desktop, stacked mobile. Left: real photo of the dealership family / showroom (NOT a stock car). Caption: "Family-owned in [City] since 1953." Right: form card with plate + state. CTA: "Tell us about your car." Humanist serif headline: "We'll buy your car. Like we have for three generations." |
| **Palette** | One warm primary (`#7B2D26` brick / `#1F4068` deep navy / dealer's choice) · `#F4EFE6` warm off-white · `#2C2A26` text · `#A3886B` warm accent |
| **Hero** | Authentic photo (lifestyle, not stock). One photo. No carousel. |
| **Transition** | Photo shrinks to a small chip in the corner; wizard slides in beside it. Dealer's identity stays present without blocking. |
| **Loader** | Subtle hand-drawn line drawing of the dealership filling in |
| **For** | Single-rooftop family dealers, regional chains in small/mid markets where personal trust matters more than speed |

### Quick chooser

| Template | Vibe | Hero | Loader | Best for |
|---|---|---|---|---|
| **Clarity** | Apple white | Form only | Thin line | Premium import single-rooftop |
| **Marquee** | Luxury dark | Wordmark + dark form | Brass arc | Luxury (BMW/Audi/Lexus) |
| **Velocity** | Mass conversion | Blue gradient + yellow CTA | **Running car** | Volume / multi-rooftop / domestic |
| **Heritage** | Family-owned | Real dealership photo | Hand-drawn fill | Family dealers, regional chains |

---

## "We found your car" — exact spec for screen 2

Same data contract across all four templates, different skin.

**Required content (mobile order, top to bottom):**

1. **Hero photo** — vehicle image. Source priority: (a) trim-specific stock from a build-data API (Carfax, DataOne, ChromeData), (b) generic Y/M/M stock photo, (c) IF NEITHER → no photo, just a vehicle silhouette icon. **Never show a wrong photo.** Wrong > none.
2. **Confirmation headline** — *"We found your **2021 Honda Accord Sport**"* (bold the Y/M/M). Assertive, not interrogative ("Is this your car?" reads dealer-y).
3. **Spec chips row** — 4 small chips: Trim · Engine · Drivetrain · Color. Tappable to edit.
4. **Trim selector** — IF ambiguous, show 2–4 trim options as large radio cards. Single-tap. IF unambiguous, skip.
5. **Mileage input** — single field, number pad on mobile, placeholder "e.g. 47,000". This is the FIRST thing they manually type — everything before was tap.
6. **CTA** — "Looks right — continue" (primary). Secondary text link: "Not my car? Re-enter plate."

**What NOT to ask on this screen:** condition, options, photos, contact info. Identification only.

---

## The radical-simplicity 3-screen flow

### Screen 1 — Landing
- Dealer logo (24px, top-left)
- Headline: *"Sell your car in 2 minutes."*
- Subhead: *"Real cash offer. No haggling."*
- License plate field
- State dropdown
- "Get my offer" CTA
- *Below the fold (optional):* 3-step strip, one customer quote, FAQ accordion. THAT'S IT.

### Screen 2 — "We found your car"
Per spec above.

### Screen 3 — Five condition prompts on one scroll-card
1. **Mileage** (or collected on screen 2)
2. **Overall condition** — radio: Excellent / Good / Fair / Rough, each with one-line description
3. **Any accidents on the title?** — Yes / No
4. **Any current mechanical issues or warning lights?** — Yes / No (text field if Yes)
5. **Do you own it outright?** — Yes / Still paying / Lease

**CTA: "Get my offer"** → branded calculating animation (template-dependent loader) → **Offer screen.**

### What to CUT from current Autocurb implementation

Current `src/components/sell-form/` has 9+ steps. For the radical-simplicity track:

| Step | Action |
|---|---|
| `StepPhotoChoice`, `StepPhotos` | **Move to AFTER the offer** (Carvana model). Photos before offer = abandonment. |
| `StepVehicleBuild` | Auto-populate from VIN/plate. If build API fails, fall back to one trim chooser. |
| `StepFinalize` | **Collect contact info AFTER the offer.** Single biggest dealer-y mistake. |
| `StepHistory` standalone | Fold into the 5-question condition card. |
| `LiveOfferPreview` | **Kill it.** Live ranged estimate makes the final offer feel like a downgrade. |
| `VehicleSummaryBar` persistent at top | Kill on mobile, keep as small chip on desktop only. |

**Keep:** `BBVehicleCard` (this becomes your "we found your car" surface), `StepCondition`, `StepGetOffer`, `SubmissionSuccess`.

---

## Things that should NEVER be above the fold of a 2026 sell-your-car page

1. Stock hero photo of a car
2. Dealer hours, phone number, address block
3. Map embed
4. "About us" / dealer history paragraph (Heritage template handles this with one photo + caption — that's the ceiling)
5. Press / "as seen on" logo strip
6. Long FAQ list (>3 collapsibles)
7. Multi-tab navigation (Buy / Sell / Service / Parts / Finance)
8. **Required email/phone/name fields before the offer**
9. Live chat bubble that pops a greeter on landing
10. Promo banners ("$500 trade bonus this month!")
11. Inventory carousel ("While you're here, see our new Civics")
12. Verbose progress bar with step labels

---

## Sources

- [Carvana — Sell My Car](https://www.carvana.com/sell-my-car) (referenced; 403)
- [Carvana Sell or Trade Help Center](https://www.carvana.com/help/sell-or-trade)
- [Carvana 2025 Jon Hamm campaign — investor release](https://investors.carvana.com/news-releases/2025/06-10-2025-130105541)
- [Proximity Lab — Carvana platform UX case study](https://www.proximitylab.com/work/carvana-platform-ux-design/)
- [Figma — How Carvana Fuels Consistency and Scale](https://www.figma.com/blog/how-carvana-fuels-consistency-and-scale/)
- [shipyourcarnow — Carvana sell walkthrough](https://www.shipyourcarnow.com/auto-transport/selling-your-car-on-carvana-a-step-by-step-walkthrough/)
- [iSeeCars — How to Sell Your Car to Carvana](https://www.iseecars.com/articles/how-to-sell-your-car-to-carvana)
- [CarEdge — Sell to Carvana review](https://caredge.com/guides/sell-to-carvana)
- [CarMax — Sell My Car](https://www.carmax.com/sell-my-car) (referenced; 403)
- [CarMax — How to sell your car](https://www.carmax.com/articles/how-to-sell-your-car-to-carmax)
- [CarMax Offer Watch / Value tracker](https://www.carmax.com/value)
- [CarMax nationwide at-home pickup, 2025](https://investors.carmax.com/news-and-events/news/news-details/2025/CarMax-Rolls-Out-Nationwide-At-Home-Pickup-Sell-Your-Car-Without-Leaving-Your-Driveway/default.aspx)
- [CarMax "Wanna Drive?" repositioning, Aug 2025](https://media.carmax.com/press-releases/news-release/2025/CarMax-is-Shaping-the-Future-of-Car-Shopping-with-New-Wanna-Drive-Brand-Positioning-and-Tagline/default.aspx)
- [sellmyride.com — Platform](https://sellmyride.com/platform)
- [sellmyride — Ingersoll deployment](https://ingersoll.sellmyride.com/)
- [Ingersoll Auto of Danbury — Sell Your Car](https://www.ingersollautoofdanbury.com/Sell-Your-Car)
- [Ingersoll Auto of Pawling — Sell Your Car](https://www.ingersollautoofpawling.com/sell-your-car)
- [sellyourcartoingersoll.com](https://www.sellyourcartoingersoll.com/)
- [AccuTrade Website Trade-In Tool](https://www.carscommerce.inc/accutrade-website-trade-in-tool/)
- [AccuTrade dealer widget docs](https://help.accu-trade.com/en/articles/5698745-dealer-widget)
- [KBB Instant Cash Offer for dealers](https://b2b.kbb.com/solutions/ico/)
- [TradePending — Trade widget](https://tradepending.com/products/trade/)
- [Roadster Trade-In Appraisal](https://roadster.com/products/trade_in_appraisal/)
- [GiveMeTheVin — Sell Us Your Car](https://www.givemethevin.com/sell-us-your-car)
