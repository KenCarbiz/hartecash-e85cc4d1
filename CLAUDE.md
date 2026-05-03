# CLAUDE.md — Repo-wide notes for AI assistants

## ⚠️ Database migrations are NOT auto-applied on merge to `main`

Lovable's GitHub sync deploys **frontend code and edge functions** when commits
land on `main`. It does **not** execute SQL files in `supabase/migrations/`.
Merging a PR that adds a migration file will silently leave the production
database untouched until a human runs the migration.

This has caused two production incidents already:
- `site_config.demo_mode` column added in code but missing in DB
- `/admin?section=changelog` stuck on Apr 6 because Apr 7–May 3 backfill
  migrations (`20260501050000_*`, `20260503140000_*`) were never applied

### How to actually apply migrations after merging

Pick **one** of these — all hit the same Supabase project (ref `ptiwdwfdckfqivoocyvp`):

1. **Lovable Push** — in the Lovable editor, "Push to Supabase" button on the
   migration. Easiest for one-off Lovable-authored changes.
2. **`supabase db push`** — from a local checkout with the Supabase CLI linked
   to the project. Applies every unapplied file in `supabase/migrations/`.
3. **SQL Editor paste** — open the migration file, copy the contents, paste
   into the SQL editor in the Supabase dashboard, run. Use this for
   migrations you want to inspect before running.
4. **`psql`** — if you have `PG*` env vars loaded, run
   `psql -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql`.

### Migration authoring rule

**Every migration must be idempotent.** Use `IF NOT EXISTS`,
`ON CONFLICT DO NOTHING`, or `WHERE NOT EXISTS` guards on every `CREATE` /
`INSERT` / `ALTER`. This makes it safe to re-run, safe to merge across
branches, and safe to apply out of order with hot-fixes.

After data changes, end the file with:
```sql
NOTIFY pgrst, 'reload schema';
```
so PostgREST picks up column / type changes without a restart.

### When you're an AI assistant and merge a PR with a new migration

State explicitly in the PR / chat that **the migration still needs to be
applied** and link to this section. Do not assume it ran.
