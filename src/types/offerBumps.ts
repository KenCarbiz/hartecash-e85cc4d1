/**
 * Shared shape for the line items the boost-evaluate edge function
 * writes into offer_bumps.line_items (JSONB) and emits in its
 * response payload. Imported by:
 *
 *   - src/pages/BoostOfferClarity.tsx (customer-side receipt)
 *   - src/components/admin/CustomerFileOfferCard.tsx (dealer-side
 *     drilldown)
 *   - any future dashboard / analytics surface that aggregates bumps
 *
 * Matches the BumpLineItem interface in
 * supabase/functions/boost-evaluate/index.ts and the audit row
 * column in supabase/migrations/20260506180000_offer_bumps_audit.sql.
 *
 * The customer-side receipt uses these in the celebratory "what we
 * found" moment; the dealer-side drilldown uses them as defensible
 * appraisal output ("Photos confirm cleaner-than-rated condition,
 * +$200"). Same data, different framing — see the per-surface
 * components for tone.
 */
export interface OfferBumpLineItem {
  /** One short customer-friendly sentence — appears as the row label. */
  label: string;
  /** Dollar amount this signal contributed. Always non-negative. */
  amount: number;
  /** Stable signal_key matching boost_bump_rules + SIGNAL_DEFAULTS,
   *  e.g. "condition_upgrade", "tire_tread_high", "ocr_mileage_reappraisal".
   *  Useful for filtering / aggregation in dealer analytics. */
  source: string;
}

/**
 * The full offer_bumps row as returned by Supabase. Used by the
 * customer file OfferCard hook so the dealer can see the full
 * audit context, not just the line items.
 */
export interface OfferBumpRow {
  id: string;
  submission_id: string;
  dealership_id: string;
  previous_offer: number;
  new_offer: number;
  bump_amount: number;
  line_items: OfferBumpLineItem[];
  source: string;
  created_at: string;
}
