
INSERT INTO public.changelog_entries (entry_date, title, description, items, icon, tag, sort_order, is_active)
VALUES
(
  '2026-05-28', 'Security hardening — tightened RLS across staff & AI tables',
  'Locked down internal playbook tables and audit logs to authenticated staff only.',
  ARRAY[
    'Conversation Phases, Customer Signals, Industry Intel, Objection Playbook, and Voice Agent Persona restricted to authenticated users',
    'Permission Groups locked to authenticated staff',
    'Data Egress Log now requires admin or GM role within the same dealership',
    'Profiles update policy: users can edit themselves; admins can edit profiles in their dealership',
    'Anonymous submission scrubber strips offered_price, internal_notes, and cadence_* fields when the caller is not staff'
  ]::text[],
  'Shield', 'security', 0, true
),
(
  '2026-05-28', 'XSS fix in decline-reason tracking page',
  'Customer name and reason text are now properly escaped before rendering.',
  ARRAY[
    'Added HTML escaping helper in track-decline-reason edge function',
    'Prevents script injection via customerName or reasonLabel query params'
  ]::text[],
  'Shield', 'fix', 1, true
),
(
  '2026-05-27', 'Early Access dealer signup page',
  'New /early-access landing page captures interested dealerships into the pipeline.',
  ARRAY[
    'Public /early-access form: contact name, dealership, email, phone, rooftops, current solution',
    'New early_access_signups table with platform-admin-only read access',
    'Open insert for anonymous prospects; status defaults to "new"',
    'Indexed by created_at and status for fast triage'
  ]::text[],
  'FormInput', 'feature', 2, true
),
(
  '2026-05-26', 'Platform admin sidebar — broken links fixed',
  'Every link under "Platform" in the admin sidebar now opens its section reliably.',
  ARRAY[
    'AdminSectionRenderer wired up missing platform routes',
    'Tenants screen no longer fails to mount',
    'Faster navigation between platform sections'
  ]::text[],
  'Wrench', 'fix', 3, true
),
(
  '2026-05-20', 'Subscription & products foundation',
  'Platform now models products, bundles, and per-tenant subscriptions that drive entitlements.',
  ARRAY[
    'Products and bundles schema powering Platform Billing',
    'Tiered per-location pricing model',
    'Standard view at $1,995/mo per rooftop',
    'Entitlements resolved server-side and surfaced to RequireProduct gates'
  ]::text[],
  'DollarSign', 'feature', 4, true
),
(
  '2026-05-15', 'Super Admin command center',
  'New /super-admin dashboard centralizes platform-wide monitoring for Ken and ops.',
  ARRAY[
    'Tenant health, sign-ups, and key counters in one place',
    'Quick links to per-tenant tools and View-As',
    'Gated to admins on the "default" dealership'
  ]::text[],
  'BarChart3', 'feature', 5, true
),
(
  '2026-05-12', 'Pitch deck & investor brief at /pitch',
  'Self-running sales/investor deck with ROI matrix and a built-in lead form.',
  ARRAY[
    'Interactive scroll-based deck',
    'ROI matrix tuned to dealer KPIs',
    'Built-in lead form routes to ken@ken.cc'
  ]::text[],
  'Sparkles', 'feature', 6, true
),
(
  '2026-05-08', 'Website embed toolkit for dealer sites',
  'Drop-in widgets so any dealer site can capture trade leads in seconds.',
  ARRAY[
    'HTML snippet, JS widget, and iFrame variants',
    '?store=ID parameter auto-assigns leads to the right rooftop',
    'Embed mode hides header, footer, and back-to-top for clean hosting'
  ]::text[],
  'Globe', 'feature', 7, true
),
(
  '2026-05-05', 'Promo bonus engine',
  'Run date-windowed trade-in bonuses without touching offer math.',
  ARRAY[
    'Configurable bonus amounts and date ranges',
    'Applied before floor/ceiling logic so guardrails still hold',
    'Visible to staff in the offer breakdown'
  ]::text[],
  'Zap', 'feature', 8, true
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
