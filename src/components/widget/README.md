# Trade/Sell Slide-Out Widget — framing

An embeddable, persistent **trade/sell-your-car** slide-out that dealers
drop onto **their own** inventory site. It "follows the customer" across
the dealer's pages and, on a **VDP** (vehicle detail page), prompts the
customer to **apply their firm offer as a trade-in** toward that car.

Visually it's the minimal **moto / MotoAcquire** theme, **watered down** —
the disclosures and process-explanation copy from the full landing flow
are dropped.

> Status: **framing/scaffold**. The plumbing is wired and compiles; the
> two "real work" hooks (Black Book lookup + offer persistence) are
> marked with `TODO` and stubbed. See the checklist below.

## Why this was mostly plumbing already

The hard parts — the slide-out drawer, "follow the customer", VDP
detection, tenant resolution, attribution, the firm-offer lookup — were
already built for the existing inventory embed. This widget reuses them.

| Capability | Reused from | Notes |
|---|---|---|
| One-tag install on dealer site | `public/embed-loader.js` | `<script data-tenant=…>` |
| Slide-out drawer / overlay | `public/embed.js` | backdrop, header, close, auto-resize |
| Follows the customer | `public/embed.js` | floating pill + sticky bar + `hartecash_embed_state__{dealerId}` |
| VDP vehicle detection | `public/embed.js` | JSON-LD → microdata → DMS DOM → OG → URL |
| Tenant/dealer resolve | `embed-config` edge fn | `data-tenant` slug |
| Attribution / analytics | `embed_events`, `embed-track` | `embed_source`, `embed_vehicle_label/msrp` |
| VDP trade-in math | `EmbedLanding.tsx` `InventoryAwareBanner` | `calcTradeInValue` + `getTaxRateFromZip` |
| Firm offer | `submissions.offered_price` (+ `auto_firm_offer_pct`) | resolved by `token` |
| Moto theme primitives | `src/components/moto/Moto{Card,PrimaryButton,FormField}.tsx` | identical look |

The genuinely **new** piece is the **lean flow content** + a dedicated
iframe host, instead of rendering the dealer's full landing template.

## Files in this framing

| File | Role |
|---|---|
| `widgetTypes.ts` | Shared types: `WidgetStep`, `WidgetIntent`, `VdpContext`, `FirmOffer`, `TradeWidgetContext`. |
| `useTradeWidget.ts` | `useTradeWidgetContext` (parse URL), `useFirmOffer` (resolve offer by token), `useParentFrameSync` (postMessage contract). |
| `TradeInBanner.tsx` | VDP header: "apply your $X trade toward this {vehicle}" + effective price. |
| `TradeWidgetFlow.tsx` | The watered-down 5-step stepper (vehicle → condition → intent → contact → offer). |
| `../../pages/WidgetTrade.tsx` | Iframe host at `/widget/:dealershipId` (lean sibling of `EmbedLanding`). |

## What's deliberately dropped (the "watered down")

vs. the full moto flow (`src/components/moto/steps/*`, `sell-form/*`):

- TCPA / SMS-consent wall (`StepFinalize.tsx`)
- 8-question damage matrix → collapsed to a 3-point condition
- Multi-slot AI photo capture + "boost" upsell (`StepPhotos.tsx`)
- Ownership / color / scheduling steps
- `MotoDisclosureBar` (the host page owns chrome; behaves like `?embed=true`)

## postMessage contract (unchanged from EmbedLanding)

`window.parent.postMessage(…, "*")`:
- `{ type: "hartecash-ready", dealershipId }` — once on mount
- `{ type: "hartecash-resize", height }` — on every height change
- `{ type: "hartecash-close" }` — close button (overlay mode)
- `{ type: "hartecash-state-change", token, status, offer }` — when the
  resolved offer changes, so the floating button copy can swap to
  "Apply your $X toward this vehicle".

## Build-out checklist (next passes)

- [ ] **Vehicle step** — replace the placeholder input with the real
      Black Book lookup used by `MotoStepVehicleSearch` (VIN/plate/YMM →
      `BBVehicle`).
- [ ] **Offer step** — on contact submit, call `calculateAndPersistOffer()`
      (`src/components/moto/motoSubmission.ts`) to insert the submission,
      compute the firm offer (`offer_settings.auto_firm_offer_pct`), and
      return the token; then render the real number. Stamp
      `embed_source` / `embed_vehicle_label` / `embed_vehicle_msrp` (the
      `WidgetTrade` page already stashes these in `sessionStorage`).
- [ ] **embed.js asset** — add a `trade` asset type to `embed-config` and a
      `HarteCash.trade()` opener in `public/embed.js` that loads
      `/widget/:tenant` in the drawer with detected `vehicle_label` /
      `vehicle_msrp` / stored `token` as params. (Today it can be opened
      via the existing overlay opener pointed at the new route.)
- [ ] **Trade-in confirm** — wire the offer step's
      "Apply toward this vehicle" CTA to record the VDP target against the
      submission (reuse `embed_vehicle_label/msrp`; decide if a dedicated
      `trade_target_*` column is warranted before adding a migration).
- [ ] **Admin toggle** — surface an enable/disable for the trade widget in
      the dealer's embed config (alongside inventory/sticky/banner assets).

## Open product decisions (flagged for Ken)

1. **OTP on the lean flow?** The full flow gates the offer behind SMS
   verification. Watering that out lowers friction but weakens lead
   quality / TCPA posture. Keep, drop, or defer to post-offer?
2. **Show the number before contact?** `offer_settings.pricing_reveal_mode`
   supports `price_first`. Do we honor the dealer's setting or force
   contact-first in the widget?
3. **New embed asset vs. extend `/embed`?** This adds a parallel
   `/widget` surface. Alternatively the lean flow could be a `?template=widget`
   override on `/embed`. Parallel route chosen here for a clean separation.
