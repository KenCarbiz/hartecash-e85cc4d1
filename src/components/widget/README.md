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

## Surface: it extends `/embed` (no separate route)

Per product decision, the lean flow is **not** a parallel route — it's a
template override on the existing embed surface:

```
/embed/:dealershipId?template=widget&vehicle_label=…&vehicle_msrp=…&t=<token>&zip=…&intent=trade
```

`EmbedLanding` renders `<TradeWidget>` instead of `<LandingTemplateRouter>`
when `?template=widget` is present, reusing all of EmbedLanding's existing
iframe plumbing (resize / ready / close / state-change postMessage +
sessionStorage embed attribution). One surface, one set of plumbing.

## Files in this framing

| File | Role |
|---|---|
| `widgetTypes.ts` | Shared types: `WidgetStep`, `WidgetIntent`, `VdpContext`, `FirmOffer`. |
| `useTradeWidget.ts` | `useFirmOffer` — resolve the customer's existing offer by token. |
| `TradeWidget.tsx` | Presentational body (banner + flow) rendered by `EmbedLanding`. |
| `TradeInBanner.tsx` | VDP header: "apply your $X trade toward this {vehicle}" + effective price. |
| `TradeWidgetFlow.tsx` | The watered-down stepper (vehicle → condition → intent → contact → **OTP** → offer). |
| `../../pages/EmbedLanding.tsx` | Host — branches to `<TradeWidget>` on `?template=widget`. |

## What's deliberately dropped (the "watered down")

vs. the full moto flow (`src/components/moto/steps/*`, `sell-form/*`):

- TCPA / SMS-consent wall (`StepFinalize.tsx`)
- 8-question damage matrix → collapsed to a 3-point condition
- Multi-slot AI photo capture + "boost" upsell (`StepPhotos.tsx`)
- Ownership / color / scheduling steps
- `MotoDisclosureBar` (the host page owns chrome; behaves like `?embed=true`)

## postMessage contract (owned by EmbedLanding)

EmbedLanding already drives this; the widget body inherits it.
`window.parent.postMessage(…, "*")`:
- `{ type: "hartecash-ready", dealershipId }` — once on mount
- `{ type: "hartecash-resize", height }` — on every height change
- `{ type: "hartecash-close" }` — close button (overlay mode)
- `{ type: "hartecash-state-change", token, status, offer }` — when the
  resolved offer changes, so the floating button copy can swap to
  "Apply your $X toward this vehicle".

## Product decisions (resolved by Ken)

1. **OTP: keep.** Gate the offer behind SMS verification, like the full
   flow. The stepper includes an `otp` step between `contact` and `offer`.
2. **Reveal: contact-first (forced).** Always collect name/email/phone
   before the number; ignore `offer_settings.pricing_reveal_mode` in the
   widget. (The stepper already orders contact → offer.)
3. **Surface: extend `/embed`.** `?template=widget` override, not a
   parallel route. (Implemented.)

## Build-out checklist (next passes)

- [ ] **Vehicle step** — replace the placeholder input with the real
      Black Book lookup used by `MotoStepVehicleSearch` (VIN/plate/YMM →
      `BBVehicle`).
- [ ] **OTP step** — insert SMS verification (decision #1) between
      `contact` and `offer`, reusing the moto contact-verify path
      (`MotoStepContact` OTP) so the offer only reveals post-verify.
- [ ] **Offer step** — on verify, call `calculateAndPersistOffer()`
      (`src/components/moto/motoSubmission.ts`) to insert the submission,
      compute the firm offer (`offer_settings.auto_firm_offer_pct`), and
      return the token; then render the real number. Stamp
      `embed_source` / `embed_vehicle_label` / `embed_vehicle_msrp`
      (EmbedLanding already stashes these in `sessionStorage`).
- [ ] **embed.js opener** — add a `trade` asset type to `embed-config` and
      an opener in `public/embed.js` that loads
      `/embed/:tenant?template=widget` in the drawer with detected
      `vehicle_label` / `vehicle_msrp` / stored `token` as params.
- [ ] **Trade-in confirm** — wire the offer step's
      "Apply toward this vehicle" CTA to record the VDP target against the
      submission (reuse `embed_vehicle_label/msrp`; decide if a dedicated
      `trade_target_*` column is warranted before adding a migration).
- [ ] **Admin toggle** — surface an enable/disable for the trade widget in
      the dealer's embed config (alongside inventory/sticky/banner assets).
