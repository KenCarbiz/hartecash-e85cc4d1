# Brand Asset Checklist

Every AI-generated image you need for the Rooftop brand, mapped to its target folder and filename. When you save an image from ChatGPT / Midjourney / Sora, drop it at the exact path listed here.

> **Naming rule:** all lowercase, kebab-case, descriptive. Always `.png` for raster, `.svg` for vector logos, `.jpg` only if file size matters more than transparency.

---

## Mascot poses (8)

Confident male operator — slim black suit, lime pocket square, black-rim glasses, beard scruff, short dark hair. Cartoon line art, sticker style. Lime green `#C7FF1A` background unless noted.

| # | Pose | Use case | Save to |
|---|---|---|---|
| 1 | Hero (thumbs-up) | Landing hero, marketing pages | `public/brand/mascot/01-hero.png` |
| 2 | Pointing at viewer | CTA sections | `public/brand/mascot/02-pointing.png` |
| 3 | Holding car keys | Acquisition / AutoCurb section | `public/brand/mascot/03-keys.png` |
| 4 | Holding clipboard ("LET'S RUN YOUR ROOFTOP") | Pricing / sales decks | `public/brand/mascot/04-clipboard.png` |
| 5 | Headshot circular avatar | Nav bar, social, testimonials | `public/brand/mascot/05-avatar.png` |
| 6 | Stressed BDC ("before Rooftop") | Before/after comparison strip — this one is grayscale, no lime, no suit | `public/brand/mascot/06-stressed.png` |
| 7 | On the rooftop (cinematic 16:9) | Brand signature, About page, investor decks | `public/brand/mascot/07-on-rooftop.png` |
| 8 | Holding phone with chat bubbles | AutoFilm / AI outreach section | `public/brand/mascot/08-phone.png` |

---

## Sub-brand spot illustrations (4)

One per product brand. Cartoon inked style. Lime + black, no readable text, no human figures.

| Sub-brand | Subject | Save to |
|---|---|---|
| **AutoCurb** | Funnel collecting 4 channels (web cursor, phone, wrench, walk-in) into one lime pipeline | `public/brand/illustrations/autocurb/funnel-channels.png` |
| **AutoLabels** | Window sticker on car glass with lime checkmarks + wireless-sync arcs | `public/brand/illustrations/autolabels/window-sticker.png` |
| **AutoFilm** | Smartphone with video player UI, lime play button + 10-min clock | `public/brand/illustrations/autofilm/video-phone.png` |
| **AutoFrame** | DSLR camera with three identical car silhouettes in a row + framing cone | `public/brand/illustrations/autoframe/camera-cars.png` |

---

## Stack-flow diagram (2 versions)

The 4-channels-into-one-pipeline visual. Two registers — pick whichever fits the section.

| Version | Style | Save to |
|---|---|---|
| Cartoon (matches mascot brand) | Inked sticker style, 16:9 | `public/brand/illustrations/stack-flow/diagram-cartoon.png` |
| **Cinematic ($1M platform)** | 3D render, glass-morphism, volumetric lime light, 21:9 ultrawide — the centerpiece | `public/brand/illustrations/stack-flow/diagram-cinematic.png` |

---

## Hero / atmosphere

| Asset | Spec | Save to |
|---|---|---|
| Cinematic dealership lot at night | 16:9, lime accents only, no text | `public/brand/hero/dealership-night.png` |
| Background grid texture (seamless tile) | 512×512, tileable | `public/brand/hero/texture-grid-tile.png` |

CSS fallback for the texture is in `rooftop-landing-mockup.html` — only worth saving the image version if the AI gave you something richer than the pure-CSS grid.

---

## Social / share cards

| Asset | Spec | Save to |
|---|---|---|
| Open Graph card | 1200×630 PNG, headline + mascot | `public/brand/social/og-card.png` |
| Twitter card | 1200×675 PNG (or reuse OG) | `public/brand/social/twitter-card.png` |

---

## Logo / favicon

AI image gen is bad at this — these should be done in Figma or by a designer. The prompts are starting points.

| Asset | Spec | Save to |
|---|---|---|
| Rooftop mark — color | SVG, inverted V + dot, lime + black | `public/brand/logo/rooftop-mark.svg` |
| Rooftop mark — white | SVG, white-on-transparent variant | `public/brand/logo/rooftop-mark-white.svg` |
| Rooftop wordmark | SVG, "Rooftop" in Space Grotesk Bold | `public/brand/logo/rooftop-wordmark.svg` |
| Favicon source | 1024×1024 PNG (lime square + black mark) | `public/brand/logo/favicon-source.png` |
| Favicon (browser tab) | 32×32 PNG | `public/brand/logo/favicon-32.png` |
| Favicon (small) | 16×16 PNG | `public/brand/logo/favicon-16.png` |
| Apple touch icon | 180×180 PNG | `public/brand/logo/apple-touch-icon.png` |

Once you have the 1024×1024 favicon source, downsizing to 32 and 16 takes 30 seconds in any image editor.

---

## Empty states / transactional

Optional polish, ship after the priority assets are in.

| Asset | Use case | Save to |
|---|---|---|
| Email welcome illustration | Signup confirmation, onboarding | `public/brand/empty-states/email-welcome.png` |
| 404 / empty state illustration | "Page not found", "no results yet" | `public/brand/empty-states/404.png` |

---

## Priority order

If you're generating in batches, do them in this order — each batch builds on the previous.

1. **Mascot pose 1 (hero)** — lock the character first; everything depends on it being consistent
2. **Mascot poses 2–8** — knock these out in the same ChatGPT thread to keep the character locked
3. **Stack-flow cinematic** — the $1M centerpiece visual
4. **Sub-brand spot illustrations** — Trade / Labels / Film / Frame, all four
5. **OG card + favicon** — unlocks social shares + the browser tab
6. **Hero scene + texture** — atmospheric polish
7. **Email + 404** — last; nice-to-have

---

## After saving an image

```bash
git add public/brand/<path>
git commit -m "assets: add <asset name>"
git push
```

If you want me to wire a new image into the landing mockup, drop a comment with the path and I'll handle the integration.
