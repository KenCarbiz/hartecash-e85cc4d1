# Implementation TODO — Next-Up Product Initiatives

Queue of scoped-and-planned features waiting to ship. Each entry has a
concrete plan, estimated engineering budget, and the context needed to
start immediately without re-scoping.

Items ship on `main` directly. Land each as a single atomic commit (or
a tight series of two) so Lovable picks them up on the next sync.

---

## 1. Customer Photo-Upload Encouragement Flow

**Why:** The AI Photo Re-Appraisal system shipped in commit `122aaf3`
only works when customers upload photos. Right now photos are optional
and most customers skip them, so the suggest + auto-bump pipeline
rarely fires. This is the single highest-revenue product change in the
queue — one good decline-recovery email with photo upload can claw
back a five-figure deal per month.

**Goal:** Three new touch points that nudge customers to upload photos
with a clear "get a higher offer" incentive.

### Touch point 1 — Offer page upsell card

New card on `src/pages/OfferPage.tsx` below the hero price, shown when
`offered_price` exists and `photos_uploaded = false`:

```
📸 Upload photos, potentially increase your offer
Our AI can review photos of your vehicle and confirm the condition is
better than expected — which could mean up to $X more on your offer.

Takes 2 minutes · 6 photos recommended · Completely optional

[Upload Photos →]
```

The `$X` number is the dealer's actual `ai_auto_bump_max_dollars`
setting so it's truthful per dealer. Truthful numbers build trust;
vague "up to thousands more" language sounds like a scam.

### Touch point 2 — Decline recovery notification

New notification trigger `customer_offer_decline_recovery` wired into
`send-notification/index.ts`. Fires via email + SMS when:
- Customer taps "No thanks" on the offer page, OR
- Customer doesn't accept within 30 minutes of seeing the offer, OR
- `progress_status` moves to `offer_declined`

**Email copy:**
```
Hi {{customer_name}},

We saw you didn't accept the ${{offered_price}} offer for your
{{vehicle}}. Before you go — our system can potentially raise your
offer for free if the condition is better than you described.

Upload 6 quick photos: {{photo_upload_link}}

Our AI reviews them in 2 minutes, and if your car looks cleaner than
expected, your offer automatically goes up. No strings, no commitment.

— {{dealership_name}}
```

**SMS copy** (under 160 chars):
```
{{dealership_name}}: Your offer could go UP. Snap 6 quick photos and
our AI may raise your number in 2 min: {{short_link}}. Reply STOP.
```

Respects existing opt-outs + quiet hours because it flows through the
existing `send-notification` infrastructure unchanged.

### Touch point 3 — Result screen with three outcomes

New post-upload screen at `src/pages/UploadPhotos.tsx`. After photos
upload and the AI re-appraisal runs, show one of three screens based
on the result:

| Outcome | Screen | CTA |
|---|---|---|
| **AI bump applied** (auto or suggested) | Confetti + "Great news — your offer went up $X!" with new price | **[Accept New Offer]** |
| **AI confirmed reported condition** | "Thanks! Your offer of $X is confirmed." | **[Accept Offer]** |
| **AI saw worse condition** | "Thanks! Our team is reviewing your submission — we'll contact you shortly." | *(no auto-action)* |

**Critical rule:** The third case never shows the customer a lowered
number. Worsening recommendations always route to the Appraiser Queue
for a human to decide how to communicate (or simply hold the number).

### Bonus — Optional photo categories

Below the required 6 photos, a new "Unlock a bigger offer" section:

- Dashboard with engine on → "proves no warning lights" → up to +$800
- Tire tread close-ups → "newer tires" → up to +$400
- Service records → "regular maintenance" → up to +$600
- Clean interior → "cabin wear grade" → up to +$500
- Aftermarket upgrades → wheels, stereo, bed liner → varies

Each with its own upload slot. Gamified: "4 of 5 bonus items uploaded."
Each optional photo feeds more data into `analyze-vehicle-damage` so
the AI has a stronger signal for its condition call.

### Scope

- **Files touched:** `OfferPage.tsx`, `UploadPhotos.tsx`,
  `send-notification/index.ts`, new `src/lib/photoUploadIncentives.ts`
  helper, possibly new `customer_offer_decline_recovery` template
  rows in `notification_templates`
- **Migration:** New trigger key, optional `photos_prompt_seen_at`
  column on submissions for analytics
- **New edge function:** None (reuses the existing re-appraisal
  pipeline)
- **Estimated budget:** 1-2 days, single commit
- **Dependencies:** None — everything it needs is already on main
  (AI photo re-appraisal, analyze-vehicle-damage, notification system)

### Open questions before shipping

1. Should the decline-recovery email go out to customers who decline
   politely (clicked No) AND customers who just ghost (never replied)?
   Or just the politely-declined ones?
2. Do we cap the "up to $X" number at the dealer's `ai_auto_bump_max_dollars`
   or at the absolute cap across any bump they've ever done?
3. The bonus photo categories add complexity to the form — do we ship
   them in the same commit or as a follow-up?

---

## 2. Tread & Brake Depth Integration (Tekmetric first)

**Why:** Dealers manually type tread depth and brake depth into the
inspection sheet today, every time. The data has already been captured
by the service department — often by the dealer's own techs during a
recent oil change. The fact that it doesn't flow into the inspection
sheet is a pure workflow gap.

**Goal:** Auto-populate tread + brake measurements from the dealer's
shop management system when a customer appears in both systems.

### Integration landscape (research summary)

| Tool | API available? | Notes |
|---|---|---|
| **Hunter Quick Tread / Quick Check Drive** | Yes, via WebOffice (private integrator agreement) | Drive-over laser, highest accuracy. Phase 3 target. |
| **Tekmetric** | Yes — documented REST API with OAuth2 | **Phase 1 target.** Independent-shop leader. `api.tekmetric.com`. |
| **Shop-Ware** | Yes — REST API | Phase 2. |
| **Mitchell 1** | Yes — REST API | Phase 2. |
| **CDK Service / Reynolds ERA** | Enterprise-only | Phase 4, big-group tier. |
| **Bosch / Beissbarth TireInspect** | No — CSV export to monitored folder | Phase 3.5, low priority. |
| **Uveye** | Enterprise API ($2,500/mo site fee) | Phase 5, only worth it for AutoNation/Group 1 scale. |
| **DualTread / handheld lasers** | No API at all | Never — use the QR handoff fallback. |

### Phase 1 — Tekmetric integration

**Why Tekmetric first:** Largest independent-shop market share, clean
documented API, fast OAuth2 setup, and the biggest % of our target
dealers use it. Most new installs in 2023-2025 picked Tekmetric.

**Data model:**
- New table `shop_system_connections`:
  - `dealership_id`, `system` (`tekmetric` | `shop_ware` | etc.),
    `external_shop_id`, `oauth_refresh_token` (encrypted),
    `connected_at`, `last_sync_at`
- New columns on `submissions`:
  - `tread_data_source` (`manual` | `tekmetric` | `shop_ware` | ...)
  - `tread_data_synced_at`
  - `brake_data_source`, `brake_data_synced_at`

**Edge function:** `shop-system-sync-tread-brake`
- Input: `{ submission_id }` OR `{ customer_phone, vin }`
- For each connected shop system:
  1. Look up customer by phone or VIN via shop system API
  2. Fetch most recent inspection with tire/brake measurements
  3. If found within 90 days, populate:
     - `submissions.tire_lf/rf/lr/rr` (32nd")
     - `submissions.brake_*` (mm or 32nd", converted if needed)
     - Set data source fields
  4. Write `activity_log` entry "Tread data synced from Tekmetric"
- Called from:
  - `AppraisalTool.tsx` "Pull Inspection Data" button (already
    exists — just route it through this new function)
  - `InspectionCheckIn.tsx` after VIN is captured (auto-sync if the
    customer is found)

**Admin setup:** New section under System Settings → "Shop System
Connections" with an OAuth-style connect flow (redirect to Tekmetric,
exchange code, store refresh token). One-time per dealer.

**Scope:**
- **Files touched:** `AppraisalTool.tsx`, `InspectionCheckIn.tsx`,
  new `src/components/admin/ShopSystemConnections.tsx`
- **New edge function:** `shop-system-sync-tread-brake`
- **Migration:** `shop_system_connections` table + submission columns
- **Estimated budget:** 2-3 days **with a Tekmetric dev account**.
  Without one, ship the skeleton (OAuth flow + pluggable abstraction)
  and wire real credentials when they're available.
- **Dependencies:** Tekmetric developer account + OAuth client ID

### Phase 1.5 — QR handoff for laser tools without an API

Before any real API integration lands, there's a zero-integration win:
a **"Laser Tool Handoff"** screen in the mobile inspection flow that
shows a big QR code the tech scans from their laser tool. The QR
deep-links into the inspection sheet with the tread/brake fields
pre-focused and a numeric keypad primed.

- Workflow today: tech takes laser measurement → walks to tablet →
  finds inspection sheet → finds the right field → types → repeats
- Workflow with QR handoff: tech takes laser measurement → scans QR
  on tablet → keypad pops up on their phone with the field already
  focused → types the number → hits enter → field on tablet updates
  via realtime subscription

**Files touched:** `InspectionSheet.tsx`, `MobileInspection.tsx`, new
`src/pages/LaserToolHandoff.tsx`
**Scope:** 1 day
**Ships independently of Phase 1 API work**

### Phase 2+ — Future phases

- **Phase 2:** Shop-Ware + Mitchell 1 integrations (add more shop
  system adapters to the `ShopSystemConnector` interface)
- **Phase 3:** Hunter WebOffice (direct laser-drive-over), requires
  Hunter integrator agreement
- **Phase 4:** CDK Service and Reynolds ERA (enterprise tier, needed
  for AutoNation-size deals)
- **Phase 5:** Uveye for fully-automated drive-through inspection

---

## 3. Handheld Laser / BLE Hardware Integration Plan

**Why:** Item 2 above targets the dealer's shop management system as
the source of tread/brake data. This item targets a complementary path:
**the appraiser's personal iPhone or iPad**, paired to a handheld laser
tool via Bluetooth or a lightweight API. Useful when the dealer doesn't
have a shop management system to read from, when the appraiser is
walking the service drive away from any terminal, or when the dealer
wants faster measurement capture than manual entry allows.

### Hardware landscape (researched April 2026)

| Tool | Cost | Tread | Brake | iOS connectivity | API/BLE surface |
|---|---|---|---|---|---|
| **Bartec TECH600Pro + BT bridge** | ~$2,050 | ✅ Laser | ❌ | Bluetooth LE → Bartec Mobile iOS app | Published SDK (2024), REST endpoint on paired app |
| **Snap-on EPIC / Solus Edge + laser module + brake sensor** | ~$3,200 | ✅ Laser | ✅ Add-on | Bluetooth LE → ProLink iQ iOS app | Mitchell 1 Integration API (shared with Mitchell 1 shop system integration in Item 2) |
| **JumpStart TreadReader** | ~$950 | ✅ Laser (< 1s per tire) | ❌ | Native BLE to iPhone/iPad | Published BLE profile + iOS companion app with share-sheet export |
| **Innova Drivelink Pro** | ~$280 | ✅ Stylus laser | ✅ Via OBD2 ABS data | iOS via Innova Connect app | Published REST API + webhook-capable |
| **Hunter Quick Tread / Quick Check Drive** | Already-owned hardware | ✅ Drive-over | ❌ | None (PC-only WebOffice) | Private integrator agreement — Phase 3 in Item 2 |
| **Bosch / Beissbarth TireInspect** | Already-owned hardware | ✅ Drive-over | ❌ | No iOS | CSV folder poll only |
| **DualTread / generic handhelds** | $300-800 | ✅ Laser | ❌ | None | No API, no BLE — manual only |
| **Uveye** | $2,500/mo site fee | ✅ Drive-over CV | ✅ Drive-over CV | None | Enterprise API — Phase 5 in Item 2 |

### Recommended two-tool stack per appraiser

**For tread: JumpStart TreadReader ($950)** — BLE-native, iOS-native,
under 1 second per wheel, cheapest real option in the BLE class.

**For brakes: Innova Drivelink Pro ($280)** — OBD2 dongle that reads
the car's ABS module to extract brake pad wear data on a subset of
2018+ vehicles. **Coverage is not universal** — see the OBD2 Brake
Compatibility Matrix below. Always paired with a manual fallback
path (QR handoff or mechanical calipering) for the vehicles where
OBD2 brake data isn't available.

**Total hardware per appraiser: ~$1,230.** Half the cost of Snap-on,
covers tread on every vehicle and brakes on roughly two-thirds of
2018+ used inventory, all iOS-native.

### OBD2 Brake Compatibility Matrix (critical — read before shipping Phase 2)

OBD2 does **not** have a native standardized PID for brake pad
thickness. The SAE J1979 standard covers engine, emissions, and
transmission — nothing about brake friction material. "OBD2 brake
readers" work by querying the ABS/EBS module on the same CAN bus
using manufacturer-specific proprietary identifiers, which means
coverage varies dramatically by brand.

Two underlying data sources the ABS module may use:

**Source A — Physical pad wear sensors (authoritative):** A resistance
loop embedded in the brake pad that the ABS module reads. As the pad
wears, the loop resistance changes, and at the wear limit the loop
breaks. The ABS module can report a specific percentage or mm
estimate, and often per-corner resolution.

**Source B — Calculated pad life (estimate):** No physical sensor;
instead, the ABS module runs a usage model that counts brake
applications, weights by brake pressure and vehicle speed, and tracks
time since the last pad replacement (reset when a tech clears the
counter). Less accurate than physical sensors — typically ±5-10% on a
well-maintained car, ±15% on an abused one.

| Brand / Era | Data source | Accuracy | Per-wheel or per-axle | Innova reads it? |
|---|---|---|---|---|
| **BMW 2010+** | Physical sensor | ±2mm | Per-axle, some per-corner | ✅ Excellent |
| **Mercedes 2012+** | Physical sensor | ±2mm | Per-axle | ✅ Excellent |
| **Audi / VW / Porsche 2015+** | Physical sensor | ±2mm | Per-axle | ✅ Excellent |
| **Volvo 2016+** | Physical sensor | ±2mm | Per-axle | ✅ Good |
| **Ford 2018+** | Calculated % | ±10% | Per-axle only | ⚠️ Partial — label "estimated" |
| **GM 2019+** | Calculated % | ±10% | Per-axle only | ⚠️ Partial — label "estimated" |
| **Stellantis (Ram/Jeep) 2019+** | Calculated % | ±15% | Per-axle only | ⚠️ Partial — label "estimated" |
| **Hyundai / Kia 2020+** | Calculated % | ±15% | Per-axle only | ⚠️ Partial — label "estimated" |
| **Toyota 2018+** | Not exposed over OBD2 | — | — | ❌ Not readable |
| **Honda / Acura 2018+** | Not exposed over OBD2 | — | — | ❌ Not readable |
| **Subaru 2018+** | Not exposed over OBD2 | — | — | ❌ Not readable |
| **Nissan / Infiniti 2018+** | Not exposed over OBD2 | — | — | ❌ Not readable |

**Rough coverage of the post-2018 used-car population:**
- **Excellent reads** (physical sensor): ~20% — European luxury
- **Estimated reads** (calculated %): ~40% — domestic + Korean
- **No OBD reads at all**: ~40% — Japanese (Toyota/Honda/Subaru/Nissan)

### Practical gotchas

1. **Proprietary protocols break on firmware updates.** Manufacturers
   occasionally ship ABS firmware updates that break third-party
   readers. Innova updates their dongle database monthly to keep up.
   Expect 1-2% of reads to fail silently at any given time. The
   integration **must** log failures to `activity_log` so we can
   detect pattern breaks (e.g. BMW reads suddenly at 0% for a week =
   firmware update shipped).

2. **Manual fallback is never optional.** At least 40% of the used
   vehicle population (Toyota/Honda/Subaru/Nissan) cannot be read via
   OBD2 at all. Phase 2 ships alongside the QR handoff + mechanical
   measurement path (Phase 0) — it never replaces them.

3. **Never surface estimated brake % as authoritative.** The UI must
   show a visible "estimated" badge whenever `brake_data_source` is
   `obd_calculated_estimate`, and the appraisal sheet must explicitly
   note when a number came from a software model vs a physical sensor.

### Revised Phase 2 data model

- New column `submissions.brake_data_source` with values:
  - `manual` — typed in by hand
  - `mechanical` — from the QR handoff + caliper or laser
  - `obd_physical_sensor` — authoritative read from BMW/MB/Audi/etc.
  - `obd_calculated_estimate` — software model from Ford/GM/etc.
- New table `obd_brake_compatibility` keyed on `(make, year_min, year_max)`
  that the edge function consults before attempting a read. Saves
  wasted API calls on incompatible vehicles and lets us show the
  appraiser "OBD brake read not supported for this vehicle —
  measure manually" immediately instead of after a failed read.

### Revised Phase 2 flow

1. Appraiser plugs Innova OBD dongle into the vehicle
2. Edge function receives the webhook, pulls the VIN (universal
   1996+ read), decodes make + year
3. Look up `obd_brake_compatibility` to classify the vehicle into
   one of four tiers (excellent / partial / not-available / unknown)
4. **Excellent tier:** Read resistance-loop values, write to
   `brake_lf/rf/lr/rr`, label source `obd_physical_sensor`, confidence
   HIGH
5. **Partial tier:** Read calculated %, convert to mm estimate using
   make-specific coefficients, label source `obd_calculated_estimate`,
   confidence MEDIUM, UI shows "estimated" badge
6. **Not-available tier:** Skip OBD read entirely, route appraiser to
   the QR handoff flow for mechanical measurement
7. **Unknown tier** (rare): Attempt the read, log failure if it
   fails, fall back to QR handoff
8. Every read (success or failure) writes an `activity_log` entry

### Integration phasing

| Phase | Hardware | Integration type | Engineering | Hardware cost |
|---|---|---|---|---|
| **Phase 0** | None | QR handoff screen in inspection sheet — tech scans tablet QR with their phone, gets a focused numeric keypad for each wheel/brake, realtime sync back to tablet. Zero BLE, zero API. | ~1 day | $0 |
| **Phase 1** | JumpStart TreadReader | iOS share-sheet URL scheme: tech captures 4 readings in JumpStart app → taps Share → picks "Open in Autocurb" → deep-links into inspection sheet with all four wheel values pre-filled. Zero BLE code in our app. | ~2 days | $950/appraiser |
| **Phase 2** | Innova Drivelink Pro | Wire Innova's REST webhook into our existing `receive-obd-scan` edge function. Appraiser plugs OBD dongle into the vehicle, Innova app calls our webhook, brake pad life populates. | ~1 day | $280/appraiser |
| **Phase 3** | Snap-on EPIC (for dealers who already own it) | Mitchell 1 Integration API — same integration path as the Mitchell 1 shop system plan in Item 2. Snap-on EPIC writes into Mitchell 1, we read from Mitchell 1. | ~3 days | $0 (existing hardware) |
| **Phase 4** | Bartec TECH600Pro (for dealers who already own it) | Bartec mobile SDK + their 2024 integration endpoint. Pair-once flow from System Settings. | ~2 days | $0 (existing hardware) |
| **Phase 5** | Direct Web Bluetooth to JumpStart | Capacitor/React Native shell exposing BLE to our admin PWA. Bigger architectural commit. Only worth it if Phase 1 share-sheet flow hits friction. | ~1 week | $0 (hardware from Phase 1) |

### Phase 0 detail — QR handoff screen (zero hardware, ships alone)

**Why it comes first:** It's a pure software win that helps every
dealer *today*, including the ones with no intent to ever buy new
hardware. The laser tool they already own stays in use; the QR handoff
just replaces the "walk to tablet → find field → type" loop with a
focused mobile keypad that auto-advances per wheel.

**Flow:**
1. UCM opens the inspection sheet on the tablet
2. Taps "Capture Tread + Brake" → a fullscreen QR code appears
3. Tech scans the QR from their phone
4. Phone opens `/inspection/:id/capture` with a single-screen form:
   four big wheel slots (LF / RF / LR / RR) for tread, four for brake
5. Each field focuses automatically, 32nd-inch numeric keypad, tap
   Enter to advance to the next wheel
6. Each value writes to the submission in realtime via Supabase
   subscription
7. Tablet shows the values updating live so the UCM can stop the
   tech if a number looks wrong
8. When all 8 values are in, the tech taps "Done" and both devices
   show a confirmation

**Files touched:**
- New `src/pages/InspectionCaptureHandoff.tsx` (mobile capture page)
- `src/pages/InspectionSheet.tsx` + `MobileInspection.tsx` — add
  "Capture Tread + Brake" button that shows the QR
- New route in `App.tsx`
- Uses existing Supabase realtime — no new edge functions

**Scope:** 1 day, ships independently of any other item.

### Phase 1 detail — JumpStart share-sheet integration

**Why:** Zero BLE code on our side. The JumpStart iOS app already does
the BLE pairing + reading; we just receive the export.

**Setup:**
1. Register a custom URL scheme in the app — `autocurb://inspection/:id/tread`
2. Document it in a "Connect Your Tread Laser" setup page for
   appraisers — configure JumpStart to share via our scheme
3. When the share-sheet URL hits the app, parse the query params
   (`?lf=8&rf=7&lr=6&rr=6`) and populate the inspection sheet

**Fallback if JumpStart's share export format doesn't include the full
per-wheel breakdown:** Use their iOS `UIActivityItem` copy format and
parse the human-readable text. Uglier but works.

**Scope:** 2 days + 1 JumpStart unit to test against.

### Open questions before any phase ships

1. Does the dealer already own a tread tool? We should ask during
   onboarding so Phase 0 (QR handoff) is the right default for
   existing-hardware dealers and Phase 1 (JumpStart) is the right
   recommendation for new-hardware dealers.
2. Do any target dealers own Snap-on EPIC? Phase 3 only makes sense
   if we have 3+ dealers asking for it.
3. Is brake pad data via OBD2 accurate enough for our condition model?
   Needs a 20-vehicle calibration test against mechanical
   measurements before Phase 2 goes live.

---

## 4. DealerTrack Payoff Verification Integration

**Why:** Every consumer-sourced car with an existing loan requires a
**10-day payoff quote** from the lienholder before the dealer can cut
a check. Today the workflow is:
  1. Appraiser asks the customer for the lender name
  2. Appraiser calls the lender directly (or faxes a POA)
  3. Waits 10 minutes to 24 hours on hold
  4. Manually types the payoff into `submissions.loan_payoff_amount`
  5. Hopes the customer didn't make a payment between the quote and
     the check-cut date (or the dealer ends up short)

This manual loop is the single biggest bottleneck between "customer
accepts the offer" and "dealer cuts the check." On service-drive
acquisitions specifically, customers often walk because they can't
wait around for 45 minutes while the dealer's BDC tries to get a
payoff quote from Ally. **DealerTrack's Payoff Quotes service
automates this entire path** — API-driven payoff requests that hit
the major lienholder network and return a fresh 10-day quote in
under 30 seconds.

**Goal:** Integrate DealerTrack Payoff Quotes so the platform
automatically fetches and continuously refreshes payoff amounts
during the acquisition window. The UCM sees a live payoff number
on the customer file, and when the check request is generated the
payoff has been re-verified within the last 10 days.

### Integration landscape (who can provide the data)

| Provider | Network coverage | API-based? | Business model |
|---|---|---|---|
| **DealerTrack Payoff Quotes (Cox Automotive)** | Widest — Ally, Chase, Wells Fargo, Capital One, Bank of America, credit unions via Open Lending, most captives (Ford Credit, GM Financial, Toyota Financial, Honda Financial, Nissan Financial, etc.) | ✅ Yes — partner API, requires integrator agreement | Per-quote fee (~$3–5) or bundled in an existing DealerTrack subscription |
| **RouteOne** | Similar to DealerTrack — slightly fewer credit unions but stronger captive finance coverage | ✅ Yes — partner API, requires integrator agreement | Per-quote fee or bundled subscription |
| **Cox Automotive PayoffAssist** | Consumer-facing version of DealerTrack Payoff Quotes — customer enters credentials | ⚠️ Consumer-web-driven | Per-quote fee, friction from customer-credential requirement |
| **Direct lender APIs** (Ally DealerServices, GM Financial dealer portal, Chase DealerCommercialServices, etc.) | Lender-specific — only the one brand | ✅ Yes per lender | Free for established dealer relationships, each lender is a separate integration |
| **Carfax TitleHistory lien data** | Nationwide title records | ⚠️ Title lien presence only — NOT real-time payoff amount | Subscription fee |
| **Manual fax/phone workflow** | Everything | ❌ | Dealer labor time |

### Recommended approach — DealerTrack Payoff Quotes

Cox Automotive is already in the dealer's life on multiple fronts
(vAuto, Manheim, Autotrader, Dealer.com, DealerTrack, Xtime, KBB ICO).
Most dealers targeted by this product already have an active
DealerTrack subscription. Integrating to DealerTrack Payoff Quotes:

- **Doesn't add a new vendor relationship** — dealer uses their
  existing DealerTrack credentials
- **Has the widest coverage** — the network covers effectively every
  major US auto lender plus credit unions
- **Is API-based** — a single edge function can hit the partner API
- **Is bundled into most DealerTrack packages** — dealers already
  paying for DealerTrack get the payoff quotes included OR at a
  discounted per-quote rate

**Phase 1 target: DealerTrack Payoff Quotes.**

### Data model

New columns on `submissions`:
- `loan_payoff_amount` — already exists today (populated manually)
- `loan_payoff_verified` — already exists today (boolean flag)
- `loan_payoff_updated_at` — already exists today (timestamp)
- `loan_payoff_expires_at` — **new** — when the 10-day quote goes
  stale and must be re-fetched
- `loan_payoff_source` — **new** — enum: `manual` | `dealertrack` |
  `routeone` | `direct_lender` | `payoff_assist`
- `loan_payoff_quote_id` — **new** — external reference returned
  by DealerTrack so we can pull the PDF quote for the check-request
  document packet
- `loan_payoff_per_diem` — **new** — daily interest accrual so the
  UI can show "payoff as of today + $X/day" if the check is cut
  after the quote date

New table `shop_system_connections` (already proposed for Tekmetric
integration in Item 2) gets reused here with an additional
`dealertrack_payoff` connection type so dealers only authorize Cox
once per account and unlock multiple integrations.

### New edge function: `dealertrack-payoff-fetch`

**Input:** `{ submission_id, force_refresh? }`

**Flow:**
1. Load submission + `loan_company` + customer SSN/DOB + VIN
2. Load dealer's DealerTrack credentials from `shop_system_connections`
3. If `force_refresh = false` AND `loan_payoff_expires_at > now()`,
   return the cached payoff — no new API call, no per-quote fee
4. Otherwise call DealerTrack Payoff Quotes API with the customer's
   PII + vehicle info
5. Parse the response: 10-day payoff amount, per diem, lender
   confirmation number, quote PDF URL
6. Update `submissions.loan_payoff_*` fields atomically
7. Write `activity_log` entry "Payoff Refreshed via DealerTrack"
   with the delta from the previous amount
8. If the new amount is materially different (>$500) from the
   previous amount, fire a notification to the UCM so they know
   the cost basis changed

**Authorization:** A new SUPABASE secret `DEALERTRACK_API_KEY` for
the platform + per-dealer OAuth tokens stored encrypted in
`shop_system_connections`.

**Trigger points:**
1. **Automatic on offer acceptance:** When `progress_status` moves
   to `offer_accepted`, the edge function fires. By the time the
   customer arrives for inspection, the payoff is already verified.
2. **Automatic on check-request generation:** Before the check
   request PDF is generated, re-run the payoff fetch to ensure the
   quote is fresh. This is the critical failure point today —
   dealers cut checks against stale payoff quotes and end up short
   because the customer made a payment in between.
3. **Manual refresh button** on the customer file next to the
   payoff amount — UCM can force a refresh if they suspect a stale
   quote or the customer made a recent payment.
4. **Daily background job** that refreshes any submission in
   `progress_status = offer_accepted` with `loan_payoff_expires_at`
   within 48 hours of expiring. Piggybacks on the existing
   `revalue-service-leads` cron infrastructure.

### UI changes

**Customer file (SubmissionDetailSheet.tsx):**
- New "Loan Payoff" panel in the existing finance section:
  - Current quoted amount + quote date
  - Per diem rate ("+$X/day after [date]")
  - Source chip: **DealerTrack** / **Manual** / **RouteOne** / etc.
  - "Refresh" button (UCM/GSM only — hits the edge function)
  - "View Quote PDF" link when the source is DealerTrack
  - Amber warning chip when the quote is within 3 days of expiring
  - Red warning chip when the quote is expired

**Check request generator (handleGenerateCheckRequest in
SubmissionDetailSheet.tsx):**
- Pre-flight check — if `loan_payoff_expires_at < now() + 24h`,
  automatically trigger a refresh before generating the packet
- Include the DealerTrack quote PDF as a page in the generated
  check-request packet so the GSM approving the check has the
  authoritative source document in hand

**Appraiser Queue:**
- New chip color/reason: **"Payoff Pending"** — surfaces any
  offer-accepted submission whose payoff fetch failed or expired
  without a refresh, so the UCM can step in manually

### Scope

- **Files touched:** `SubmissionDetailSheet.tsx`, `AppraiserQueue.tsx`,
  `useAdminDashboard.ts`, new
  `src/components/admin/DealerTrackConnectionCard.tsx`
- **New edge function:** `dealertrack-payoff-fetch` + optional
  `scheduled-payoff-refresh` (daily cron)
- **Migration:** 4 new submission columns + `shop_system_connections`
  enum extension
- **Estimated budget:** 3-4 days **with DealerTrack partner API
  credentials in hand**. Without them, ship the skeleton (UI + data
  model + a mock edge function that returns hardcoded test data) and
  wire real credentials when DealerTrack approves the integrator
  agreement.
- **Dependencies:**
  1. DealerTrack Integrator Agreement — the real blocker. Cox takes
     3-6 weeks to approve new partners. **Start the paperwork now
     even if we're not ready to build yet.**
  2. Dealer's existing DealerTrack subscription with Payoff Quotes
     enabled. Most dealers targeted by this product already have it.

### Open questions before shipping

1. **Per-quote billing model.** Does DealerTrack charge per payoff
   quote, per month, or is it bundled into their existing subscription?
   This determines whether we need to expose a "payoff quote budget"
   to the dealer or if it's free flowing.
2. **PII handoff.** DealerTrack requires SSN + DOB to authenticate
   a payoff request on most captive lenders. Do we collect these
   fields from the customer on acceptance, or does the appraiser
   type them in manually during the in-person walk-around? Consent
   language + TCPA-style disclosure needs to be drafted.
3. **RouteOne fallback.** Some dealers are RouteOne-only (competitor
   to DealerTrack). Should we ship a pluggable interface from day
   one so both networks work via a single `PayoffProvider`
   abstraction, or start DealerTrack-only and add RouteOne in a
   later phase once we see real demand?
4. **Per-diem handling.** When a payoff quote is 7 days old and
   the check is being cut today, do we auto-refresh OR just add
   `per_diem × days_elapsed` to the quote and call it close enough?
   DealerTrack's quotes explicitly authorize the per-diem math for
   up to 10 days, so the manual adjustment is legal — the question
   is whether we prefer automatic-refresh conservatism (extra API
   costs) or mathematical addition (zero API cost).

### Why this is high priority

1. **Unblocks same-day acquisitions.** The customer who walks in,
   accepts the offer, and wants to drive out with a check can't
   today because payoff verification takes 30+ minutes. With
   DealerTrack Payoff Quotes, it takes 30 seconds and the entire
   "wait around while we call your bank" friction disappears.
2. **Prevents losing money on stale quotes.** Manual workflows lead
   to checks cut against quotes the customer has since made a
   payment on. Dealer ends up short by $200–$800. Automating the
   pre-check-request refresh eliminates this.
3. **Fits the existing check-request packet flow.** The
   `handleGenerateCheckRequest` function already bundles
   appraisal + DL + title + payoff documentation into a printed
   packet — adding the DealerTrack quote PDF as an extra page is
   a one-line change inside that function.
4. **Compounds with every other feature.** Every acquisition channel
   (off-street, service drive, in-store trade, walk-in via
   Inspection Check-In) ends at "generate check request," and
   every one of those paths is currently limited by manual payoff
   verification. Ship this once, everything speeds up.

### 🔑 Critical extension — Service-Drive Equity Mining automation

**This is the single biggest reason to ship the DealerTrack
integration.** Equity mining already exists on the platform as a
feature for stale service-drive leads — what it's missing is the
verified-payoff signal that makes it actually convert customers.

**The flow that DealerTrack Payoff Quotes unlocks:**

1. **Service customer books an appointment** via the dealer's
   standard scheduling system
2. **Platform detects the booked appointment** for a customer with
   a `lead_source = service` submission (or auto-creates one if the
   service customer isn't yet in the acquisition pipeline)
3. **Platform automatically queries DealerTrack Payoff Quotes**
   using the VIN + customer identifiers already on file — no
   customer interaction required, runs silently in the background
4. **Platform computes real-time equity:**
   `equity = bb_retail_avg - loan_payoff_amount`
   (or `offered_price - loan_payoff_amount` if the customer has
   already seen an offer)
5. **When the customer arrives for service**, the service advisor
   has a pre-loaded "equity opportunity" card on their tablet:
   > "Your 2022 Accord is worth $23,400. You owe $18,800.
   > **You have $4,600 in equity that most customers don't know
   > they're sitting on.** Want to hear your options?"
6. **The customer sees their own equity on the offer page** as a
   dedicated section above the standard offer display:
   ```
   Your Car's Market Value:    $23,400
   Your Loan Payoff:           $18,800 ✓ Verified via DealerTrack
   ─────────────────────────────────────
   Your Equity:                 $4,600
   ```
   This is dramatically more conversion-effective than showing the
   offer alone. Most customers don't know what they owe vs. what
   their car is worth — surfacing the gap makes the acquisition
   story sell itself.
7. **Offer-vs-equity comparison on the portal:** Alongside the
   cash offer, show the equity breakdown and (when the offer
   exceeds the payoff) the net check amount the customer walks
   away with after the lender is paid off. This eliminates the
   "wait how does this work" confusion that kills service-drive
   deals.

**Why this is the biggest acquisition lever in the platform:**

- Service customers are already the **highest-quality channel**
  (Executive Dashboard labels them as such). The trust is already
  established because they chose to bring their car to the dealer
  for service. All that's missing is the conversation starter.
- **Equity is the conversation starter.** A customer who walks in
  for an oil change and walks out being told "by the way, you
  have $4,600 in equity locked in this car" is dramatically more
  likely to engage with an acquisition offer than one who receives
  a cold outreach about selling their car.
- **DealerTrack Payoff Quotes automates the one data point that
  makes equity math possible.** Manual payoff lookup scales to
  maybe 10 customers a day per appraiser. Automated payoff
  lookup scales to every service customer on the schedule —
  hundreds per day per store.
- **The Historical Insight Engine shipped last week gets
  compounding value.** Combining verified payoff + AI condition
  scoring + historical outcome data means the platform can
  predict — before the customer even arrives for service —
  exactly which customers are the hottest acquisition targets
  and pre-brief the service advisor with equity amounts,
  confidence scores, and recommended opening lines.

**Additional data model for this flow:**

- New column `submissions.verified_equity_amount` — the computed
  equity at the time of payoff verification, stored so the UI can
  display it without recomputing on every render
- New column `submissions.equity_notified_at` — when we first
  showed the customer their equity number (either via portal,
  email, or service advisor handoff), so we can measure conversion
  lift by time-from-notification
- New notification trigger `customer_equity_opportunity` — fires
  when verified equity crosses a dealer-configurable threshold
  (default $2,500). Sends the customer an email + SMS inviting
  them to learn more. Gated by TCPA opt-out + quiet hours like
  every other customer-facing trigger.
- New "Equity Opportunities" sidebar item in the Acquisition
  group — a filtered view of service-drive submissions with
  `verified_equity_amount > dealer_threshold` that haven't been
  acted on yet. Priority-sorted by equity amount descending so
  the UCM works the biggest fish first.

**This turns DealerTrack integration from an "operational
improvement" into a "core acquisition conversion engine."**
The payoff verification isn't the product — the equity-mining
loop it unlocks is the product. The integration should be
planned and pitched with equity mining as the primary use case,
not as a back-office workflow fix.

### 🚨 BLOCKER — Consent text update must ship BEFORE DealerTrack goes live

Pulling a consumer's loan payoff from DealerTrack (or any lender
API) is **regulated data access**, not a casual workflow step. Every
payoff request must be backed by explicit written consumer
authorization on file, or the lender can legally refuse the request
AND the dealer is exposed to audit risk. This must land as a code
change BEFORE the DealerTrack integration switches on — not after.

**The legal stack that requires it:**

- **Gramm-Leach-Bliley Act (GLBA)** — Section 501 requires financial
  institutions to get "clear and conspicuous" consumer authorization
  before sharing account info with third parties. Lenders on the
  DealerTrack network enforce this contractually.
- **FCRA (Fair Credit Reporting Act)** — Payoff pulls that touch
  credit-reporting data require a "permissible purpose," which in
  dealer-acquisition context is "written instructions of the
  consumer."
- **State privacy acts** — CCPA (California), CPRA, VCDPA (Virginia),
  CPA (Colorado), **CTDPA (Connecticut** — relevant to the target
  customer base**)** all require disclosure of every data source the
  platform queries about the consumer.
- **DealerTrack's own Terms** — Cox requires the dealer to certify
  that the consumer has given written authorization for each payoff
  pull before the API call is accepted.

**What the consent text must cover** (three distinct elements):

1. **Purpose** — why the data is being pulled (to complete the
   vehicle acquisition the customer requested)
2. **Scope** — what data will be pulled (payoff amount, lender name,
   account status, per-diem rate)
3. **Duration** — how long the authorization is valid (typical
   language: "for 90 days from submission or until withdrawn in
   writing")

**Proposed copy for consent v2** — add as a new paragraph inside
`src/lib/consent.ts::buildConsentText()` and publish as version v2
in the existing `consent_text_versions` table:

> **Payoff Verification Authorization.** By submitting this form
> and providing your VIN, name, and contact information, you
> authorize **{{dealership_name}}** and its authorized service
> providers (including DealerTrack and/or RouteOne) to request a
> 10-day payoff quote from your current lienholder, if any, for the
> sole purpose of completing the vehicle acquisition you've
> requested. You authorize your lender to release your payoff
> amount, per-diem interest rate, and account status to us in
> response to this request. This authorization remains valid for 90
> days from the date of submission or until you withdraw it in
> writing. A copy of every payoff request we make on your behalf is
> available upon request.

**How it ties into what's already shipped:**

The TCPA consent versioning infrastructure from Wave 3 (migration
`20260411000100_consent_text_versioning.sql`) already supports this.
Every consent_log row carries a `consent_version` tag that
references a row in `consent_text_versions` with the full legal
text. Adding v2 is a pure data operation plus a one-line version
bump — the read path, audit trail, and history UI already exist.

**Two-commit implementation plan:**

Commit 1 — Consent text v2 (pre-DealerTrack blocker):
- New migration `20260412000000_consent_v2_payoff_authorization.sql`
  inserts the v2 row into `consent_text_versions` with the full
  payoff authorization language
- `src/lib/consent.ts::buildConsentText()` appends the new paragraph
  to the existing TCPA copy
- `src/lib/consent.ts::CURRENT_CONSENT_VERSION` bumps from "v1" to
  "v2" — every new submission after deploy automatically gets v2
  stamped into `consent_log`
- Old v1 submissions keep their v1 tag — audit trail remains honest
  about which customers pre-date the payoff authorization

Commit 2 — Customer-facing disclosure surfaces:
- New "What happens next?" bullet list on the sell-form submit
  screen that includes: *"If you have a loan, we'll request a
  payoff quote from your lender on your behalf"*
- New "Data we've accessed" panel on the customer portal listing
  every payoff pull with timestamp + source (DealerTrack / RouteOne
  / manual). Fulfills CCPA/CTDPA data-access-disclosure requirements
  AND gives the customer a reason to trust the flow.
- Privacy Policy page update (`src/pages/PrivacyPolicy.tsx`) — new
  section "Payoff Quote Requests" mirroring the consent text in
  longer form for the standard privacy policy layout

**Scope:** ~4-6 hours total across both commits. Pure text + one
migration + one data panel + one privacy policy section. Zero
dependencies on the DealerTrack integration itself — these commits
ship FIRST so that by the time payoff API credentials land, every
new consumer in the database has already authorized the pull.

**Hard requirement:** Commit 1 MUST ship before Item 4 (DealerTrack
Payoff Verification) goes into production. The first payoff request
made against a submission whose `consent_version = 'v1'` is legally
exposed — the v1 consent text doesn't authorize the data access.
Either:
- Ship consent v2 first and backfill authorization consent for
  existing v1 customers via email re-affirmation, OR
- Only run DealerTrack payoff pulls on submissions where
  `consent_version IN ('v2', ...)` — the edge function should
  enforce this at query time, not trust the caller

The edge function `dealertrack-payoff-fetch` should carry an
explicit consent check as its first step:

```ts
// Before any payoff request, verify the consumer has consent on
// file that includes payoff authorization (v2 or later).
const { data: submission } = await supabase
  .from("submissions")
  .select("consent_version, token")
  .eq("id", submission_id)
  .maybeSingle();

const { data: consent } = await supabase
  .from("consent_log")
  .select("consent_version")
  .eq("submission_token", submission.token)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!consent || !PAYOFF_AUTHORIZED_VERSIONS.includes(consent.consent_version)) {
  return { error: "Consumer has not authorized payoff retrieval. Request re-consent." };
}
```

This is defense in depth — even if the UI somehow lets a v1
submission reach the DealerTrack flow, the edge function refuses
the request at the boundary.

---

## Prioritization

If shipping one of these per sprint:

1. **Photo Upload Encouragement (1-2 days)** — biggest revenue impact,
   zero new dependencies, pure frontend + one notification template.
2. **Start the DealerTrack Integrator Agreement paperwork (0 days
   coding, ~3-6 weeks of Cox paperwork)** — this is on a parallel
   track because Cox takes weeks to approve new partners, so the
   paperwork has to start *now* even though no code ships until
   credentials are issued. Do this the same day as item 1.
3. **Laser Tool QR Handoff — Phase 0 (1 day)** — zero-integration,
   zero-hardware quick win that helps every dealer immediately.
4. **DealerTrack Payoff + Service-Drive Equity Mining (3-4 days
   once credentials land)** — this is the highest-leverage
   acquisition conversion feature in the entire queue. The
   integration unlocks automated equity mining for every service
   customer, which turns the existing service-drive channel from
   "highest-quality leads" into "highest-converting leads." See
   Item 4 for the full flow.
5. **Tekmetric Tread/Brake sync (2-3 days)** — needs a dev account
   but is the biggest operational upgrade in inspection workflow
   for dealers with shop management systems.
6. **JumpStart TreadReader integration — Phase 1 (2 days + $950
   hardware)** — paired with Phase 0, closes the tread-capture loop
   without BLE engineering on our side.
7. **Innova Drivelink Pro — Phase 2 (1 day + $280 hardware)** —
   brake data via OBD2, reuses the existing `receive-obd-scan`
   endpoint.

**Critical sequencing note:** DealerTrack paperwork should start the
same day as the Photo Upload Encouragement build because Cox's
integrator approval is the long-pole blocker. Everything else in the
queue can ship immediately; DealerTrack is gated on a 3-6 week
approval window that has nothing to do with engineering velocity.
Start the paperwork, ship the other items in parallel, and have the
integration ready to build the moment credentials arrive.

The first three items ship within ~1 week of calendar time.
Item 4 ships ~4-6 weeks out depending on DealerTrack approval.
Full hardware stack (items 6 + 7) reaches every appraiser for
~$1,230 in per-seat hardware, roughly one-third the cost of the
Snap-on equivalent.
