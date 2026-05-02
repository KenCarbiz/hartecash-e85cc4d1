# Demo Mode (Black Book Sandbox Kill-Switch)

A reversible per-tenant kill-switch that keeps the public sell-flow,
cadence engine, TCPA consent capture, and AI voice scheduling fully
exercisable while Black Book credentials are unavailable.

## What it does

When `site_config.demo_mode = true` for a tenant:

1. **`bb-lookup` edge function** skips the upstream Black Book call and
   returns a synthetic vehicle (2021 Toyota Camry SE, full set of
   wholesale / retail / tradein tiers populated). The response is
   marked with `_demo: true` so downstream code can detect it. No
   bill-able BB call is made.
2. **`QuickOfferForm` + `SellCarForm`** clamp the customer-facing offer
   to `site_config.demo_offer_amount` (default **$23,599**). Both
   `offered_price` and `estimated_offer_low/high` get the same flat
   number written so the offer page reads it from any field.
3. **`OfferPage`** skips its on-load and on-edit recompute against the
   synthetic BB stub so the offer stays pinned to the demo amount even
   if the customer (or staff) edits a condition field.
4. **Lead source** gets a `-demo` suffix on every demo submission so
   reporting can filter / exclude them.
5. **Cadence engine, send-notification, TCPA consent, voice AI** all
   continue to run normally — they key off `offered_price` /
   `estimated_offer_high` being non-null, which the demo path always
   sets.

When `demo_mode = false` (default) **none of the above takes effect** —
the live BB pipeline runs byte-for-byte as before.

## Turning it on

**Per tenant (recommended):**

1. Open the admin → **Setup · Dealer → Communication Channels**.
2. Top card: **Demo mode**.
3. Flip the switch to ON. Optionally adjust **Demo offer amount**.
4. Click **Save demo mode**.

**Global (every tenant, ignores the per-tenant flag):**

Set the edge function env var `BB_DEMO_MODE=true` in Supabase:

```bash
supabase secrets set BB_DEMO_MODE=true
```

Useful when you want to suppress every tenant's BB calls regardless of
their own setting.

## Turning it off

Reverse of the above:

1. Channels tab → Demo mode switch OFF → Save.
2. (If used) `supabase secrets unset BB_DEMO_MODE`.

The next form submission will hit the real Black Book API again. No
data backfill is required — existing demo submissions in the database
keep their `-demo` lead_source tag and clamped offer; new ones get
live pricing.

## Verification checklist

- [ ] Toggle demo_mode ON in the Channels tab.
- [ ] Submit a fresh QuickOfferForm — verify the offer page shows
      $23,599 and `submissions.lead_source` ends in `-demo`.
- [ ] Verify `submissions.cadence_state = 'declined'` and
      `cadence_next_due_at ≈ now() + 24h` (cadence engine fired).
- [ ] Submit a fresh full SellCarForm — same checks.
- [ ] Edit a condition field on the offer page — offer stays at $23,599.
- [ ] Toggle demo_mode OFF — submit again — verify a real Black Book
      lookup runs (check `bb_vin_cache` for a fresh row) and the offer
      reflects the live computed estimate, not $23,599.

## Files involved

- Migration: `supabase/migrations/20260502090000_demo_mode_blackbook_fallback.sql`
- Edge function: `supabase/functions/bb-lookup/index.ts`
- Forms: `src/components/QuickOfferForm.tsx`, `src/components/SellCarForm.tsx`
- Offer page recompute gate: `src/pages/OfferPage.tsx`
- Admin toggle: `src/components/admin/ChannelsSettings.tsx`
- Type defaults: `src/hooks/useSiteConfig.ts`
