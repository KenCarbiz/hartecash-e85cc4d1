-- Atomic increment for voice_campaigns totals to fix the read-modify-write
-- race in voice-call-webhook. Bland.ai can fire webhooks out-of-order or
-- duplicated under load; the previous code read totals, computed the new
-- value, and wrote it back — last write wins, lost increments.
--
-- This RPC does the increment in a single SQL statement so concurrent
-- webhooks don't trample each other.

CREATE OR REPLACE FUNCTION public.increment_voice_campaign_totals(
  _campaign_id uuid,
  _calls_inc integer DEFAULT 0,
  _connected_inc integer DEFAULT 0,
  _converted_inc integer DEFAULT 0
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.voice_campaigns
     SET total_calls_made = COALESCE(total_calls_made, 0) + _calls_inc,
         total_connected  = COALESCE(total_connected, 0) + _connected_inc,
         total_converted  = COALESCE(total_converted, 0) + _converted_inc,
         updated_at       = now()
   WHERE id = _campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_voice_campaign_totals(uuid, integer, integer, integer)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
