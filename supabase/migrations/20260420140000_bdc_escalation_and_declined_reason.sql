-- BDC workflow: capture declined-offer reasons + track escalations
-- to a manager.
--
-- Context: BDC reps live on the phone chasing two questions when a
-- customer doesn't convert — "why didn't you accept the offer?" and
-- "when can we book an inspection?". When they hit a wall (price
-- objection they can't bridge, stalled customer, something weird)
-- they escalate to a manager. The platform now captures both of
-- those explicitly so managers can see a prioritized escalation
-- queue and the dealer can analyze declined-offer reasons in
-- aggregate (conversion diagnostics).

-- ─── Declined-offer reason capture ────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS declined_reason text,
  ADD COLUMN IF NOT EXISTS declined_notes text,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_by text;

COMMENT ON COLUMN public.submissions.declined_reason IS
  'Canonical reason the customer did not accept the offer. Enum-shaped text — one of: price_too_low, sold_elsewhere, financing_issue, changed_mind, lease_buyout_conflict, unreachable, other. Captured by BDC during follow-up.';
COMMENT ON COLUMN public.submissions.declined_notes IS
  'Free-form note accompanying declined_reason. BDC fills this in after the follow-up call.';
COMMENT ON COLUMN public.submissions.declined_at IS
  'When the declined reason was logged.';
COMMENT ON COLUMN public.submissions.declined_by IS
  'Email of the staff member who logged the declined reason.';

-- ─── Escalation to manager ─────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS escalated_to_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalation_notes text,
  ADD COLUMN IF NOT EXISTS escalation_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_created_by text,
  ADD COLUMN IF NOT EXISTS escalation_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_resolved_by text;

COMMENT ON COLUMN public.submissions.escalated_to_manager IS
  'True while a BDC / sales rep has flagged this lead for a manager to step in. Flips back to false when a manager resolves it. Drives the Escalations badge in the manager queue.';
COMMENT ON COLUMN public.submissions.escalation_reason IS
  'Short tag for why the lead was escalated. Enum-shaped text — one of: price_objection, customer_stalled, trade_complication, competitor_offer, technical_issue, other.';
COMMENT ON COLUMN public.submissions.escalation_notes IS
  'Free-form context from the escalator so the manager can pick up the thread without a second call.';
COMMENT ON COLUMN public.submissions.escalation_resolved_at IS
  'When a manager marked the escalation handled. Null while the escalation is open.';
COMMENT ON COLUMN public.submissions.escalation_resolved_by IS
  'Email of the manager who resolved the escalation.';

-- Index the open-escalations set — the manager queue polls this.
CREATE INDEX IF NOT EXISTS submissions_open_escalations_idx
  ON public.submissions (dealership_id, escalation_created_at DESC)
  WHERE escalated_to_manager = true;

NOTIFY pgrst, 'reload schema';
