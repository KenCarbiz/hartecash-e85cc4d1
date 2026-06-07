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

### Do NOT put `cron.schedule(...)` calls in `supabase/migrations/`

Cron schedules are managed by Lovable's cron tool, NOT static
migration files. The `current_setting('app.supabase_service_role_key',
true)` pattern that some older migrations use resolves to an empty
string in this Supabase project, so re-applying a `cron.schedule`
migration would replace a working schedule with one that 401s on
every tick.

If a new cron job is needed:
1. Author the RPC / function the cron will call as a normal migration.
2. Ask Lovable to register the cron via its tool, supplying the
   schedule string and target.
3. If the cron must live in a migration for some reason, hand-craft
   the `Authorization` header with the known-working anon key —
   don't use the `current_setting('app.supabase_service_role_key')`
   form.

Existing files that are NO-OP-on-replay (Lovable already registered
the cron, file body would break it):
- `20260509030000_voice_pipeline_retry_cron.sql`
- `20260509060000_purge_storage_cron.sql`

Both carry a `⚠️ DO NOT APPLY VIA LOVABLE PUSH` header. The RPC that
was bundled in 060000 was extracted to `20260509080000_purge_pickup_rpc.sql`
(safe to push).


After data changes, end the file with:
```sql
NOTIFY pgrst, 'reload schema';
```
so PostgREST picks up column / type changes without a restart.

### When you're an AI assistant and merge a PR with a new migration

State explicitly in the PR / chat that **the migration still needs to be
applied** and link to this section. Do not assume it ran.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
