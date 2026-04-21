-- Split the sales_bdc role into two, and add a dedicated GM role.
--
-- Context: sales_bdc historically covered both salespeople and BDC
-- reps. The product now distinguishes them — BDC's job is booking
-- inspection appointments and handling declined-offer objections
-- (with escalation to a manager), while a salesperson owns the
-- customer through the deal. Separate roles let us tailor the
-- customer-file UI: BDC gets prominent "book inspection" + "escalate"
-- + "log objection" affordances, sales gets the broader workflow.
--
-- General Manager (gm) splits off from gsm_gm. A GM is owner-adjacent
-- and sees the executive HUD (conversion rate, lead source mix,
-- employee performance) plus the holding-cost math that requires the
-- dealership's floor-plan rate. GSM continues to approve deal
-- finalized / check request / purchase complete; GM additionally sees
-- the ownership-level dashboards.
--
-- Existing users are not migrated here — 'sales_bdc' rows stay on
-- sales_bdc (treated as BDC going forward), and 'gsm_gm' rows stay on
-- gsm_gm. Dealers can promote individuals into the new roles from
-- Staff & Permissions once the application layer ships.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gm';

NOTIFY pgrst, 'reload schema';
