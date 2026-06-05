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
| `TradeWidget.tsx` | Branded panel (dealer-logo header + ×) rendered by `EmbedLanding`. |
| `TradeInBanner.tsx` | VDP header: "apply your $X trade toward this {vehicle}" + effective price. |
| `TradeWidgetFlow.tsx` | MotoAcquire-style stepper: vehicle (VIN/plate+state → confirm) → condition (4-pt) → intent → contact (+track toggle) → value (range → **OTP** → firm offer). |
| `../../pages/EmbedLanding.tsx` | Host — branches to `<TradeWidget>` on `?template=widget`. |

## Flow parity with MotoAcquire (Stevens Creek Toyota reference)

| MotoAcquire screen | Our step |
|---|---|
| VIN / plate + state | `vehicle` (entry) |
| Confirm detected vehicle + car image | `vehicle` (confirm) |
| Condition: Fair / Good / Very Good / Excellent | `condition` |
| Trade or Sell | `intent` |
| Contact + "Track value monthly" toggle (default off) | `contact` |
| KBB-style range + disclaimer + Edit Mileage + red "Get Firm Offer" | `value` (range) |
| — (our kept-OTP gate behind "Get Firm Offer") | `value` (verify) |
| Firm appraisal / next step | `value` (firm) |

## What's deliberately dropped (the "watered down")

vs. the full moto flow (`src/components/moto/steps/*`, `sell-form/*`):

- TCPA / SMS-consent wall (`StepFinalize.tsx`)
- 8-question damage matrix → collapsed to the 4-point condition scale
- Ownership / color / scheduling steps
- `MotoDisclosureBar` (the host page owns chrome; behaves like `?embed=true`)

(The AI photo **boost** is *not* dropped — it's retained as an optional,
dealer-toggled step, same as the main flow.)

## postMessage contract (owned by EmbedLanding)

EmbedLanding already drives this; the widget body inherits it.
`window.parent.postMessage(…, "*")`:
- `{ type: "hartecash-ready", dealershipId }` — once on mount
- `{ type: "hartecash-resize", height }` — on every height change
- `{ type: "hartecash-close" }` — close button (overlay mode)
- `{ type: "hartecash-state-change", token, status, offer }` — when the
  resolved offer changes, so the floating button copy can swap to
  "Apply your $X toward this vehicle".

## Same engine, same admin settings (NOT widget-specific)

The widget produces identical leads + offers to the main landing flow
because it calls the **same** backend — the proprietary "waterfall"
valuation — and honors the **same dealer admin settings**. Nothing about
the pricing is reimplemented here.

| Behavior | Source of truth | Wired |
|---|---|---|
| Firm-offer math / aggressiveness | `offer_settings` (incl. `auto_firm_offer_pct`) via `calculateAndPersistOffer` → `calculateOffer` | ✅ |
| VIN / plate decode | `bb-lookup` edge fn | ✅ |
| SMS-code gate before firm offer | `formConfig.require_phone_verification` | ✅ |
| AI photo boost / re-evaluation | `formConfig.step_ai_photos` | ✅ (UI; AI re-inspect stubbed) |
| Collect contact **before/after** offer | `formConfig.offer_before_details` | ◻︎ next refinement (needs compute-before-persist split) |
| Lead attribution (inventory_embed + VDP vehicle) | `sessionStorage` keys set by EmbedLanding | ✅ |

## embed.js — the slide-out opener

`public/embed.js` now opens the widget in a **right-side ⅓-width slide-out
panel** (`.hc-panel`, slides in from the right, dims-but-keeps the dealer
page):

- `HarteCash.valueMyTrade({ dealerId })` — open it programmatically.
- `HarteCash.bindTrade({ dealerId, selector })` — wire it onto the
  dealer's existing CTAs (default `[data-hartecash-trade]`), so it
  "integrates onto all the other buttons". Detected VDP vehicle + stored
  token flow through automatically.

## Wired ✅

- Vehicle: real `bb-lookup` VIN/plate decode → confirm screen with the
  cached vehicle image.
- Value: real `estimated_offer_low/high` from the waterfall, **computed
  without persisting** (`computeWidgetEstimate`) so editing mileage can't
  duplicate a lead.
- Firm offer: persisted **exactly once** on reveal (`persistOnce` +
  `persistWidgetOffer`), stamped with embed attribution.
- OTP: real `send-customer-otp` / `verify-customer-otp`, gated by the
  dealer toggle (skips cleanly when off).
- AI boost: dealer-toggled "add photos for a higher offer" → re-eval →
  accept/save (UI complete; photo upload + AI re-inspection stubbed).
- **Returning customer**: `ResumeCard` welcomes a customer whose resume
  token resolves a locked-in offer — shows the number, the **days left**
  on the locked-in window (`price_guarantee_days`, default 8, from
  `offer_made_at`), "apply toward THIS vehicle vs. a different one" on a
  VDP, and "Start a new appraisal".
- **Accept / apply**: the firm-offer, re-eval, and ResumeCard CTAs are
  live — `markApplied` records the chosen intent + the VDP **trade target**
  (which inventory car) on the submission, broadcasts `deal_accepted` to
  the parent (floating button flips to "view your accepted offer"), and
  shows a confirmation card.
- Slide-out panel (smooth cubic-bezier slide) + button binding in
  `embed.js`; white panel; ZIP prefilled from the embed context.

## Next refinements (polish against the live site)

- [ ] **`offer_before_details`** — honor before/after-offer ordering
      (compute estimate without persisting, collect contact later) — the
      compute/persist split is now in place to support it.
- [ ] **Real AI photo pipeline** — replace the stubbed boost with the
      `MotoStepPhotos` upload + AI inspection, then re-run the waterfall.
- [ ] **Panel width/push** — optionally push page content vs. overlay to
      match the live MotoAcquire exactly.
- [ ] **Admin toggle** — enable/disable the trade widget asset in the
      dealer's embed config.
