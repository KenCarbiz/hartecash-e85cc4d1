-- Walk-away number + competitor offer tracker.
--
-- Two data points the desk manager needs to bridge objections that
-- the platform currently leaves on the table:
--
-- customer_walk_away_number — what the customer told us (or what a BDC
--   rep surfaced on a call) they expect to accept. Surfaced prominently
--   on the customer file so the desk anchors against it during
--   negotiation — "we're at $12,400, they said $13,200, spread is $800,
--   pull save-the-deal".
--
-- competitor_mentioned + competitor_offer_amount — when a customer
--   says "CarMax is offering $X" or "your number is $500 less than
--   Carvana", capturing the competitor name + number lets managers
--   (1) know immediately if we can beat the number and (2) track
--   which competitors actually cost us deals so marketing / acquisition
--   knows where to press.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS customer_walk_away_number int,
  ADD COLUMN IF NOT EXISTS competitor_mentioned text,
  ADD COLUMN IF NOT EXISTS competitor_offer_amount int,
  ADD COLUMN IF NOT EXISTS walk_away_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS walk_away_captured_by text;

COMMENT ON COLUMN public.submissions.customer_walk_away_number IS
  'What the customer said they want to walk out with. Source is wherever the staff captured it — BDC call, receptionist chat, declined-reason dialog. Null = not yet captured.';
COMMENT ON COLUMN public.submissions.competitor_mentioned IS
  'Name of the competitor the customer mentioned (CarMax, Carvana, another dealer). Free text — dealer conversion reports aggregate on this.';
COMMENT ON COLUMN public.submissions.competitor_offer_amount IS
  'Offer amount the customer says the competitor quoted. Pairs with competitor_mentioned. Feeds the save-the-deal bump calculator so the manager can see "competitor is $500 over us, match + $100 gets the deal".';
COMMENT ON COLUMN public.submissions.walk_away_captured_at IS
  'When the walk-away / competitor fields were captured. Used for freshness signals — a walk-away number from 3 days ago may no longer reflect customer expectation.';
COMMENT ON COLUMN public.submissions.walk_away_captured_by IS
  'Email of the staff member who captured the walk-away / competitor context.';

-- Index the competitor_mentioned column for dealer-level aggregation
-- reports ("which competitors lost us the most leads last quarter?").
CREATE INDEX IF NOT EXISTS submissions_competitor_mentioned_idx
  ON public.submissions (dealership_id, competitor_mentioned)
  WHERE competitor_mentioned IS NOT NULL;

NOTIFY pgrst, 'reload schema';
