<div align="center">

# Rooftop

**The platform for car people, by car people.**

The operating system for the modern dealership — trade-in, FTC pricing & window stickers, video & service NPI, and CarMax-grade photography. Four prongs. One rooftop.

[Landing mockup](./rooftop-landing-mockup.html) · [Investor brief](./HARTECASH_INVESTOR_BRIEF.md) · [CLAUDE.md](./CLAUDE.md)

</div>

---

## Why Rooftop

Cox bought a data company. Cars.com bought a widget. CarGurus is a data marketplace. None of them have **been** the salesperson, the desk, the GSM, the partner, the owner, the F&I director.

The founder has — for 25+ years. Rooftop is what happens when someone who's lived every role at the dealership builds the tools they always wished existed. It's not a feature. It's a stance.

> **They sell tools. We run your rooftop.**

## The four modules

| Module | Solves | Replaces |
|---|---|---|
| **Rooftop Trade** | AI-driven trade-in tool — not "just a form." Web + off-street + direct-to-consumer acquisition. | KBB ICO, AccuTrade, CarGurus trade |
| **Rooftop Sticker** | FTC-compliant window stickers + addenda (used & new). Auto-syncs to dealer site. Customer e-signs accessories. Audit trail. | Manual books, FTC exposure |
| **Rooftop Reach** | Custom video to the customer in <10 min of contact. Service department NPI in the same system. | CoVideo, Flick Fusion, manual BDC video |
| **Rooftop Studio** | "Auto Frame" — 95% of CarMax/360booth photo consistency without the $2M booth. | 360booth's dealer-group-only moat |

All four modules live under one login, one schema, one brand.

## Status

| Module | State |
|---|---|
| Rooftop Trade | **Live** — full pipeline from VIN/plate lookup to check request, plus service drive equity mining and walk-in VIN scan |
| Rooftop Sticker | **In progress** — see `Harte-INFINITI-FTC-Pricing-Mockup.html` |
| Rooftop Reach | **In progress** — voice AI training cabinet shipped in `feat: trade-up admin UI + voice-AI training cabinet` |
| Rooftop Studio | **Design phase** |
| Brand rename (HarteCash → Rooftop) | **In progress** on branch `claude/dealership-saas-branding-furaV` |

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), Framer Motion |
| Backend | Supabase (Postgres + Edge Functions + Auth + Storage + Realtime) |
| Auth | Supabase Auth with role-based access (RLS on every table) |
| AI | Google Gemini 2.5 Flash (vision/condition scoring), Bland (voice AI) |
| Hardware | OBDLink CX over Web Bluetooth |
| Hosting | Lovable (frontend + edge functions auto-deploy on merge to `main`) |
| Tests | Vitest |

## Getting started

```bash
# install
bun install            # or: npm install

# run the dev server
bun run dev            # vite — http://localhost:5173

# tests
bun run test           # one-shot
bun run test:watch     # watch mode

# lint
bun run lint

# production build
bun run build
```

Environment variables live in `.env.local`. See `docs/billing-stripe-setup.md` and `docs/DEPLOYMENT_CHECKLIST.md` for the full env list.

## Repository layout

```
.
├── src/                  React frontend
│   ├── pages/            top-level routes
│   ├── components/       shared UI (shadcn-based)
│   ├── integrations/     Supabase client, third-party SDKs
│   ├── hooks/, lib/, contexts/
│   └── test/
├── supabase/
│   ├── migrations/       SQL — must be idempotent (see CLAUDE.md)
│   ├── functions/        edge functions (Deno)
│   └── config.toml
├── docs/                 design audits, ops handoffs, persona guides
├── public/               static assets
├── *.html                standalone mockups (customer file, FTC pricing,
│                         rooftop landing) — open directly in a browser
├── CLAUDE.md             repo-wide notes for AI assistants — READ THIS
└── HARTECASH_INVESTOR_BRIEF.md
```

## Database & migrations

> ⚠️ **Migrations are NOT auto-applied when you merge to `main`.**
> Lovable's GitHub sync ships frontend + edge functions on merge. SQL files in `supabase/migrations/` must be applied manually. This has caused two prod incidents already.

After you merge a PR with a migration, **apply it via one of:**

1. **Lovable Push** — "Push to Supabase" button on the migration in the Lovable editor
2. **`supabase db push`** — from a local checkout with the Supabase CLI linked
3. **SQL Editor paste** — copy the file into the Supabase dashboard SQL editor and run
4. **`psql -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql`** if you have `PG*` env vars

**Authoring rule:** every migration must be idempotent. Use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, or `WHERE NOT EXISTS` guards on every `CREATE` / `INSERT` / `ALTER`.

After data changes, end the file with:

```sql
NOTIFY pgrst, 'reload schema';
```

Full notes in [CLAUDE.md](./CLAUDE.md).

## Deployment

- **Frontend & edge functions** — auto-deployed by Lovable on merge to `main`
- **Database migrations** — manual (see above)
- **Branch previews** — Lovable builds a preview for every PR branch — `[branch].lovable.app`
- **Feature flags** — Vite env vars (`VITE_*`) toggled in Lovable's env settings; rebuild ~1 min

Rollback: flip the relevant `VITE_*` flag, or `git revert` the merge commit.

## Branching & AI assistants

- `main` is production. Don't commit to it directly — every change goes through a PR.
- AI-assisted work lives on `claude/<short-task-name>` branches.
- Read [CLAUDE.md](./CLAUDE.md) before starting an AI session — it documents the migration footgun, the idempotency rule, and the conventions specific to this repo.
- One-off mockups live as standalone `.html` files at the repo root (zero deps, open in browser). See `Customer File Redesign.html`, `Harte-INFINITI-FTC-Pricing-Mockup.html`, `rooftop-landing-mockup.html`.

## Tests

```bash
bun run test           # vitest, one-shot
bun run test:watch     # vitest watch mode
bun run lint           # eslint
```

Type-checking and tests verify code correctness, not feature correctness. UI changes require manual browser testing — start the dev server and walk through the flow before declaring done.

## License

Proprietary. All rights reserved. Contact the maintainer for licensing inquiries.

---

<div align="center">

**Built by car people. Not data people.**

25+ years on every side of the desk.

</div>
