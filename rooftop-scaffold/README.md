<div align="center">

# Rooftop

**The parent brand. Built by car people, not data people.**

`rooftop.io` — the holding company and marketing site for the Rooftop family of dealership SaaS products.

</div>

---

## What this repo is

This is the **corporate / marketing site** for Rooftop the parent brand. It contains the rooftop.io landing page and shared brand assets used across all four product sub-brands.

**Product code lives in separate repos.** This repo is brand + corporate site only.

## The Rooftop family

| Product | Solves | Tagline |
|---|---|---|
| **AutoCurb** | AI-driven trade-in tool — web, off-street, direct-to-consumer acquisition | *"The AI acquisition OS."* |
| **AutoLabels** | FTC-compliant window stickers + addenda. Auto-syncs to dealer site. Customer e-signs accessories. Audit trail. | *"Stickers your auditor will love."* |
| **AutoFilm** | Custom video to the customer in <10 min. Service department NPI in the same system. | *"Show up first. In their pocket."* |
| **AutoFrame** | "Auto Frame" — 95% of CarMax/360booth photo consistency without the $2M booth. | *"CarMax photography. Every dealer."* |

All four roll up to **Rooftop** — one parent brand, four standalone products. Each can be sold separately or bundled.

## Repository layout

```
.
├── README.md                  this file
├── BRAND_ASSETS.md            asset checklist — what to drop where
├── index.html                 the rooftop.io landing page
├── .gitignore
└── public/
    └── brand/
        ├── logo/              Rooftop parent marks + favicon
        ├── mascot/            8 mascot poses (the "guy on the rooftop")
        ├── illustrations/
        │   ├── autocurb/      AutoCurb spot illustrations
        │   ├── autolabels/    AutoLabels spot illustrations
        │   ├── autofilm/      AutoFilm spot illustrations
        │   ├── autoframe/     AutoFrame spot illustrations
        │   └── stack-flow/    The 4-into-1 platform diagram (cartoon + cinematic)
        ├── hero/              Hero backgrounds, textures
        ├── social/            OG card, Twitter card
        └── empty-states/      Welcome email, 404, etc.
```

## Preview locally

The site is a single static HTML file with Tailwind via CDN — no build step needed.

**Easiest:** double-click `index.html` to open in your browser.

**With a local server** (so relative asset paths resolve cleanly when you start dropping in images):

```bash
# Python 3 (no install required on Mac/Linux)
python3 -m http.server 8000

# Or with Node
npx serve .
```

Then open http://localhost:8000.

See [BRAND_ASSETS.md](./BRAND_ASSETS.md) for the full asset checklist with prompts, target filenames, and dimensions.

## Brand at a glance

| Token | Value |
|---|---|
| **Primary** | Lime `#C7FF1A` |
| **Foreground** | Black `#0A0A0A`, off-white `#FAFAFA` |
| **Surface** | Slate `#1A1A1A`, steel `#2A2A2A` |
| **Display type** | Space Grotesk |
| **Body type** | Inter |
| **Mascot** | Confident male operator in slim black suit, lime pocket square, black-rim glasses, light beard scruff, short dark hair |
| **Voice** | Speaks dealer. No fluff. No SaaS-speak. Confident, not smug. |
| **Tagline** | *"Built by car people. Not data people."* |
| **Anti-line** | *"They sell tools. We run your rooftop."* |

## Status

| Asset class | State |
|---|---|
| Folder structure | **Live** |
| Mascot art (8 poses) | **In generation** — see BRAND_ASSETS.md |
| Spot illustrations (4 sub-brands) | **In generation** |
| Stack-flow diagram (cartoon + cinematic) | **In generation** |
| Hero / OG / favicon / texture | **In generation** |
| Logo system | **In design** — interim inline-SVG mark in `index.html` |
| Landing page | **Live in this repo** as `index.html` — open it in a browser to view |

## Contributing assets

When generated images come back from ChatGPT / Midjourney / Sora:

1. Check [BRAND_ASSETS.md](./BRAND_ASSETS.md) for the target path and filename
2. Save the file at the exact path specified
3. Commit with a message like `assets: add mascot pose 03 (keys)`
4. Push

The asset checklist also documents the prompt that generated each piece — useful when you need to regenerate a variant or hand off to a designer.

## License

Proprietary. © Rooftop.

---

<div align="center">

**Built by car people. Not data people.**

</div>
