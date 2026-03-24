-- Backfill offered_price for accepted submissions that predate the RPC update
-- Uses the same bypass flag pattern as accept_offer to skip the role-check trigger
DO $$
BEGIN
  PERFORM set_config('app.accept_offer_bypass', 'true', true);
  
  UPDATE submissions 
  SET offered_price = estimated_offer_high
  WHERE offered_price IS NULL 
    AND estimated_offer_high IS NOT NULL 
    AND progress_status NOT IN ('new', 'offer_made', 'dead_lead');
    
  PERFORM set_config('app.accept_offer_bypass', '', true);
END;
$$;