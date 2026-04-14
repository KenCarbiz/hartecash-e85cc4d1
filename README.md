# Autocurb.io
<!-- Sync test: 2026-04-14 -->

**The Operating System for Dealer-Direct Vehicle Acquisition.**

Autocurb.io turns a dealership's website, service drive, BDC, sales floor, and
used-car manager into a single acquisition engine — from the customer's first
click to the check being cut and the vehicle being pushed into inventory.

This repository contains the Autocurb.io web application (customer-facing
trade-in funnel, dealer admin CRM, embed toolkit, inspection and appraisal
tools, and multi-tenant white-label platform).

## What's in the box

- **Customer-facing trade-in flow** — VIN / plate / manual lookup, real-time
  offer generation, photo capture, document upload, price-guarantee windows,
  and Push / Pull / Tow minimum-offer certificates.
- **Dealer admin CRM** — full submission detail (customer file), progress
  tracker, role-based access (Admin / GSM / UCM / BDC / Sales / Inspector),
  activity log, appointment scheduler, check-request generator, retail
  market panel, and executive dashboard.
- **Embed Toolkit** — dealer-website integration with floating trade widget,
  VDP/SRP ghost link, full-page iframe, and PPT certificate embed.
- **Multi-tenant white-label** — corporate `site_config` with per-location
  overrides (logo, colors, hero copy, PPT, business hours, social links).
- **Automations** — 20+ Supabase edge functions for follow-ups, appointment
  confirmations, Black Book lookups, driver's license OCR, abandoned-lead
  recovery, and notification routing.
- **Compliance** — TCPA / CAN-SPAM opt-out tracking, consent logging, and
  audited activity trails on every submission mutation.

## Tech stack

- **Frontend** — Vite, React, TypeScript, Tailwind CSS, shadcn/ui,
  React Router, TanStack Query.
- **Backend** — Supabase (Postgres, Auth, Storage, Realtime, Edge Functions).
- **Integrations** — Black Book (wholesale/retail/trade-in data), NHTSA VIN
  decoding, retail listing comps, email + SMS delivery providers.

## Local development

Requirements: Node.js 18+ (recommended via
[nvm](https://github.com/nvm-sh/nvm#installing-and-updating)) and `bun` or
`npm`.

```sh
# Clone
git clone <YOUR_GIT_URL>
cd hartecash

# Install dependencies
bun install
# or: npm install

# Run the dev server
bun run dev
# or: npm run dev
```

The dev server runs on http://localhost:5173 by default.

### Environment

Copy `.env.example` (if present) to `.env` and set the Supabase URL + anon
key for the target project. Edge functions are deployed separately via the
Supabase CLI from the `supabase/functions/` directory.

### Useful scripts

```sh
bun run dev          # Start Vite dev server
bun run build        # Production build
bun run preview      # Preview a production build locally
bun run lint         # ESLint
bun run test         # Vitest
```

## Project layout

```
src/
├── components/
│   ├── admin/          # Dealer CRM, embed toolkit, onboarding, settings
│   ├── sell-form/      # Customer-facing trade-in funnel
│   └── ui/             # shadcn/ui primitives
├── pages/              # Route-level pages
├── hooks/              # Shared hooks (useSiteConfig, useTenant, etc.)
├── lib/                # Utilities, constants, print helpers
└── integrations/
    └── supabase/       # Supabase client + generated types
supabase/
├── functions/          # Edge functions (send-notification, bb-lookup, etc.)
└── migrations/         # SQL migrations
docs/                   # Investor + leadership materials
```

## Deployment

The app is deployed via Lovable and a custom domain. Pushes to `main` are
reflected in Lovable automatically. Edge functions are deployed from the
`supabase/functions/` directory via `supabase functions deploy`.

## License
<!-- pull test -->

Proprietary — © Autocurb.io. All rights reserved.
