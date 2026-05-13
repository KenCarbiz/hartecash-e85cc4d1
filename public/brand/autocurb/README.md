# AutoCurb logo assets

Drop your final logo files in **this folder** — the landing page at
`autocurb.io` (rendered by `src/pages/AutocurbLanding.tsx`) reads them
directly from `/brand/autocurb/...`. Files are served as-is by Vite, so no
build step is needed after replacing them.

## What goes here

| Filename | Where it's used | Recommended format |
|---|---|---|
| `logo-mark.svg` | Top-nav icon, footer icon, "After" comparison card, favicon-style spots | Square SVG, ~32×32 viewBox, single-color or 2-color (lime + ink) |
| `logo-wordmark.svg` | _(optional)_ Wide horizontal lockup for press kits / docs header | SVG, ~200×40 viewBox |
| `hero.svg` | Big square brand panel on the right side of the hero | SVG (or PNG ≥ 800×800), transparent or lime background |
| `favicon.svg` | _(optional)_ Browser tab icon. If present, wire it into `index.html` | Square SVG ≤ 64×64 |
| `og-card.png` | Social share image (Open Graph / Twitter) | 1200×630 PNG |

## Fallbacks

If a file is missing, the landing page falls back to an **inline SVG** drawn
in code (a stylized car-curb mark in the brand lime `#C7FF1A`). This is so
the page never breaks before you've uploaded final art. To verify your asset
is being picked up:

```bash
# from repo root
ls -la public/brand/autocurb/
# then open autocurb.io (or run `bun dev` and open localhost:5173) and check
# the network tab for /brand/autocurb/logo-mark.svg → should be 200, not 404
```

## Brand palette (for designers)

The landing page is built around this exact palette — match logos to it:

| Token | Hex | Use |
|---|---|---|
| `lime` | `#C7FF1A` | Primary accent, CTAs, brand mark fill |
| `lime-dark` | `#A8DC10` | CTA hover |
| `lime-soft` | `#E8FFA0` | _(unused but reserved)_ |
| `ink` | `#0A0A0A` | Page background |
| `slate` | `#1A1A1A` | Card background |
| `steel` | `#2A2A2A` | Borders / dividers |
| `paper` | `#FAFAFA` | Body text on dark |

Typography: **Space Grotesk** (display) + **Inter** (body).

## Upload methods

1. **GitHub web UI**: open this folder on GitHub → "Add file" → "Upload files"
   → drag your SVG/PNG in → commit to `claude/autocurb-landing-page-eNs8B`
   (or a new branch + PR).
2. **Local checkout**: `cp ~/Downloads/logo.svg public/brand/autocurb/logo-mark.svg && git add public/brand/autocurb/logo-mark.svg && git commit -m "brand: autocurb logo mark"`.
3. **Ken via Lovable**: the Lovable editor's file tree shows this directory —
   upload through the file panel and it lands here.

No code change is required to swap assets — just keep the filenames above.
