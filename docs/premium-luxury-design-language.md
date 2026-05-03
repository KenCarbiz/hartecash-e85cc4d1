# The "Million-Dollar Look" — Visual Design Language Brief

*Compiled May 2026. Synthesis of a research pass against Mercedes-Benz, Lamborghini, Bugatti, McLaren, Rolls-Royce, Bentley, Porsche, Aston Martin, Hermès, Patek Philippe, Apple. Direct fetches 403'd against Akamai/Cloudflare; per-brand observations combine first-party brand portals (Daimler Brand Navigator, Porsche Design System), agency case studies (Pentagram, Interbrand, KMS Team, Peter Saville/Dalton Maag), and trade press (Dezeen, Design Week, It's Nice That, Domus, Wallpaper).*

This brief informs the visual treatment applied to ClarityTemplate / MarqueeTemplate / VelocityTemplate / HeritageTemplate, plus the FullscreenWizard component.

---

## The shared visual grammar of $1M-budget automotive web

What appears across **5 or more** of the brands above:

| Pattern | Specifics |
|---|---|
| **Custom or custom-feeling sans-serif** | Mercedes Corpo, Bugatti Display, Bentley typeface, Porsche Next, McLaren bespoke, Riviera Nights. None use a default Google Font. The least we can do is Inter Display + a refined display sans like Söhne, Neue Haas Grotesk, or PP Editorial. |
| **Restrained palette = 1 dark + 1 mid-tone + 1 single accent** | background `#0A0A0B`–`#101013` (warm graphite, not pure black except Lamborghini); secondary `#1C1C1F`–`#26262A`; text `#F4F2EE`–`#FFFFFF` (off-white, not blue-white); one accent at 1–3% surface area. |
| **Oversized headline, ultralight or light weight** | Headlines 64–120px, weight 200–400. *Bold* is deliberately avoided in editorial. Body 16–18px at 1.55–1.7 line-height. |
| **Negative space 50–70% of the fold** | The page is "mostly empty." That emptiness reads as confidence. |
| **One commissioned hero image** per page section | No stock. No icon-and-three-bullets sections. |
| **Slow easings: `cubic-bezier(.65, 0, .35, 1)` to `(.16, 1, .3, 1)`** | Durations 500–900ms (Mercedes/Bentley/Rolls), 250–500ms (McLaren/Porsche). Nobody uses spring physics. |
| **Brand-mark loading state** | Logo strokes in, then fades. Never a spinner, never skeleton shimmer. |
| **Bottom-bordered inputs, no boxes** | Label above, 1px line, animated focus state. CTAs are *labels with chevrons*, not pill buttons with backgrounds. |
| **Hard route changes for "engaged" modes** | Configurators live at separate URLs (configurator.porsche.com, mbusa.com/build/). Marketing chrome dies; focused chrome takes over. |

---

## Three Prestige Tiers

### Tier A — Mercedes / Bentley grade → applied to **HeritageTemplate**

```
Background:    #0B0B0D   (warm graphite — not pure black)
Surface:       #15151A
Surface-hover: #1F1F25
Text primary:  #F2EFEA   (warm off-white)
Text muted:    #8C8A86
Accent:        #A88B5C   (champagne metallic — NOT yellow)
Hairline:      rgba(242, 239, 234, 0.12)
```

- **Type:** Geometric humanist sans display + same family for body. Display weight: **300 Light** at 88–112px desktop, 56–72px mobile. Body 400 Regular at 17px / 1.65. Tracking on display: -0.02em. Tracking on labels: +0.16em uppercase.
- **Family class:** Söhne, GT America Mono for micro-data, or PP Neue Montreal. Free fallback: Geist + Geist Mono.
- **Motion:** `cubic-bezier(0.65, 0, 0.35, 1)` at **700ms** for everything. Hovers 220ms opacity-only.
- **Engagement transition:** marketing layer fades to background-opacity at 700ms, then focused wizard cross-fades in over 500ms. Total handoff ~1.2s. The user feels a hush — like a showroom door closing behind them.

### Tier B — Lamborghini / McLaren grade → applied to **MarqueeTemplate** + **VelocityTemplate**

```
Background:    #050507   (true near-black)
Surface:       #0F0F12
Surface-hover: #1A1A1F
Text primary:  #FFFFFF
Text muted:    #6E6E76
Accent:        #FF6A00   (ember orange — splits McLaren papaya / Lambo giallo)
Hairline:      rgba(255, 255, 255, 0.08)
```

- **Type:** Sharp-cut grotesk display + clean neutral body. Display **500 Medium**, slight letter-condense (font-stretch 95% if available), 96–128px. Body 400 at 16px / 1.55.
- **Family class:** PP Neue Machina, Migra, or Söhne Schmal (display); Inter (body).
- **Motion:** `cubic-bezier(0.16, 1, 0.3, 1)` ("expo out") at **450ms** for transitions, **220ms** for hovers. CTAs use 1px accent underline that grows from 0 to 100% width on hover (220ms).
- **Engagement transition:** diagonal wipe (clip-path inset, top-right to bottom-left) at 600ms reveals the wizard. Marketing layer doesn't fade — it gets *cut away*. Aggressive but premium.

### Tier C — Apple / Porsche grade → applied to **ClarityTemplate**

```
Background:    #FFFFFF
Surface alt:   #F5F5F7   (Apple's exact alt — borrowed deliberately)
Hairline:      #D2D2D7
Text primary:  #1D1D1F   (not pure black — softens the page)
Text muted:    #6E6E73
Accent:        #0066CC   (single trust-blue, used only for primary CTA + links)
```

- **Type:** Single neutral sans, full weight range, all hierarchy from size + weight — never color. Display **600 Semibold** at 80–96px, tracking -0.03em. Body 400 at 17px / 1.6. Numbers (offer values) get tabular-nums and tracking 0.
- **Family class:** SF Pro Display + SF Pro Text, or Inter Display + Inter as fallback. Porsche Next-equivalent: Manrope.
- **Motion:** `cubic-bezier(0.4, 0, 0.2, 1)` at **350ms**. Snappy. No parallax, no scroll-triggered sections.
- **Engagement transition:** the form *doesn't go anywhere* — surrounding marketing slides up and out (`translateY -40px` + opacity to 0) in 400ms; form scales from 0.96 → 1.0 in the same 400ms. The form *was already the hero*; everything else just leaves.

---

## The "engage → focused mode" transition pattern

| Question | What prestige brands actually do |
|---|---|
| Hard cut, slide, or fade? | **Fade with a small scale** (Mercedes EQS Build, Apple checkout) is dominant. Lamborghini/McLaren do diagonal wipes. Nobody does a hard cut — that reads as page navigation, downmarket. |
| Modal, route, or full-screen replacement? | **Route change to a dedicated subdomain or sub-path** — Porsche → `configurator.porsche.com`, Mercedes → `mbusa.com/en/vehicles/build/...`. The implication: "you've crossed a threshold." |
| What chrome remains in focused mode? | Wordmark top-left at half size + "Save & exit" or "← Back" affordance top-right + thin progress indicator (dots, not %). That's it. |
| Reassurance for "can I go back?" | Back affordance is *labeled* — "Save and continue later." On the first focused screen, "Your progress saves automatically" sits under the headline at 60% opacity. |

**For Autocurb's wizard:** when the user submits the plate, animate the four-template marketing surface with `transform: translateY(-32px); opacity: 0` over 500ms, then mount the wizard route with body element scaled from 0.98 to 1.0 over 500ms. Lock body scroll. Wizard owns the viewport. Single top-right "Save and exit" link returning to `/`. No site nav.

---

## Six micro-decisions that separate "$1M look" from "dealer-website-with-a-form"

1. **Custom cursor over CTAs.** Default `cursor: pointer` hand is the single biggest non-luxury tell. `cursor: none` + a 24px rendered dot circle following the mouse with `mix-blend-mode: difference` is a free upgrade.
2. **Numbers are tabular and tracked at zero.** `font-feature-settings: 'tnum' 1; letter-spacing: 0`. Most dealer sites use proportional digits and the value visually wobbles between vehicles. Prestige sites *never* let numbers wobble.
3. **No drop shadows. Use a 1px hairline at 8–12% opacity.** Cards/modals/live-offer panel get a 1px border in `rgba(255,255,255,0.08)` (dark) or `rgba(0,0,0,0.08)` (light). Single decision separates Stripe from Wix.
4. **Inputs are bottom-bordered, not boxed.** Label above (uppercase, 11px, +0.16em tracking, muted), 1px bottom line, focus state animates left-to-right in 350ms with the accent. The "filled rounded box" input is dealer-site dialect.
5. **Submit button is a label + chevron, not a pill.** "Get my offer →" with a 1px hairline underline that animates on hover. No fill until pressed (active state can briefly invert). Pills with `border-radius: 9999px` and saturated brand color = fastest way to look like a 2018 SaaS.
6. **Photography placeholders are *named*.** Even before real shoots, label placeholders "Cinematic, golden-hour, 3/4 front, low camera, asphalt foreground." Better to ship with a flat dark surface and the headline alone than ship with a Shutterstock SUV. The negative space *is* the prestige cue.

---

## Per-brand quick reference

| Brand | Primary | Accent | Type | Motion |
|---|---|---|---|---|
| Mercedes-Benz | `#000000` + warm silver | EQ blue `#00ADEF` (sub-brand) | Mercedes Corpo (geometric humanist sans) | `(.4,0,.2,1)` 600–900ms |
| Lamborghini | `#040404` Bold Black | Giallo `#FEA700` (rationed) | Custom sharp grotesk | `(.16,1,.3,1)` 700–1000ms |
| Bugatti | Bugatti Blue `#1A2238`–`#2A3F8A` + white | EB monogram light blue | Custom (Huot-Marchand) | Slow horizontal slides |
| McLaren | `#0F0F10` near-black | Papaya `#FF8000` | Modernised geometric sans | `(.2,.8,.2,1)` 250–400ms |
| Rolls-Royce | Purple Spirit `#3D2A47` (replaced black 2020) | Fluoro pink, fluoro orange | Riviera Nights (custom Gill Sans Alt) | "Quiet power" — minimal until scroll |
| Bentley | British Racing Green `#004225` | Champagne gold `#C8A961` | Custom (Gill-influenced) | Editorial, environmental |
| Porsche | `#FFFFFF` (light theme default) | Porsche Red `#D5001C` (CTA only) | Porsche Next | `ease-out` 200ms |
| Aston Martin | Ink black | Racing green `#00543C` | Dalton Maag custom (Saville 2022) | Editorial photography led |
| Hermès | White | Hermès Orange `#FF6600` (1–3%) | Memphis Bold + humanist sans body | ~70% negative space |
| Patek Philippe | White | None (Calatrava cross only) | Monotype Grotesque + Garamond | "Least designed" intentionally |
| Apple | Alternates `#FFFFFF` and `#000000` per section | None — product is the color | SF Pro Display + SF Pro Text | `(.4,0,.2,1)` 400–800ms |

---

## Sources

- [Daimler Brand & Design Navigator](https://designnavigator.daimler.com/Daimler_Corporate_Typeface?lang=en)
- [Mercedes-Benz Design](https://www.mercedes-benz.com/en/design/)
- [Drew Meehan – A New Vision for MBUX](https://medium.com/@drewdraws2/a-new-vision-for-mbux-f3515dfae2b9)
- [Interbrand – Bugatti brand identity case](https://interbrand.com/work/bugatti_brandidentity_corporatedesign/)
- [Design Week – Bugatti's new branding](https://www.designweek.co.uk/issues/25-31-july-2022/bugatti-branding-new-typeface-colour-palette/)
- [BrandPalettes – Lamborghini logo colors](https://brandpalettes.com/lamborghini-logo-colors/)
- [CarBuzz – McLaren new design language](https://carbuzz.com/mclaren-new-design-language/)
- [Pentagram – Rolls-Royce](https://www.pentagram.com/work/rolls-royce-3)
- [Designboom – Rolls-Royce identity](https://www.designboom.com/design/rolls-royce-new-brand-identity-pentagram-08-25-2929/)
- [KMS Team – Bentley case](https://www.kms-team.com/en/cases/bentley/)
- [Porsche Design System v3 – Typography](https://designsystem.porsche.com/v3/styles/typography/)
- [Aston Martin – 2022 rebrand press release](https://www.astonmartin.com/en/our-world/news/2022/7/19/aston-martin-takes-off-into-new-era-with-brand-repositioning-and-new-iconic-wings-logo)
- [Dezeen – Peter Saville Aston Martin](https://www.dezeen.com/2022/07/20/aston-martin-logo-rebrand-peter-saville/)
- [Domus – Hermès new website 2026](https://www.domusweb.it/en/news/2026/01/07/herms-new-website.html)
- [Apple Developer – Fonts (SF Pro)](https://developer.apple.com/fonts/)
