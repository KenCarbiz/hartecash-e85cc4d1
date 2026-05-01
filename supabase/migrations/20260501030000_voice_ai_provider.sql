-- Voice AI provider choice — bland.ai (default) or OpenAI Realtime.
--
-- Bland.ai is dealer-domain-tuned, has built-in outbound dialing, and
-- has been our voice provider since voice-ai shipped. OpenAI Realtime
-- is faster + cheaper per minute but doesn't bundle telephony — it
-- needs Twilio (or similar) for outbound dialing, and a WebSocket
-- bridge function to stream audio between Twilio Media Streams and
-- OpenAI's WSS endpoint.
--
-- This migration adds the provider selector. The stub for the OpenAI
-- launch path lives in supabase/functions/launch-voice-call-openai/
-- and surfaces a clear "needs Twilio + OPENAI_API_KEY" message when
-- the dealer hasn't completed the bridge setup yet.

ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS voice_ai_provider text NOT NULL DEFAULT 'bland';

ALTER TABLE public.dealer_accounts
  DROP CONSTRAINT IF EXISTS dealer_accounts_voice_ai_provider_check;
ALTER TABLE public.dealer_accounts
  ADD CONSTRAINT dealer_accounts_voice_ai_provider_check
  CHECK (voice_ai_provider IN ('bland', 'openai'));

COMMENT ON COLUMN public.dealer_accounts.voice_ai_provider IS
  'Outbound voice agent provider. bland = bland.ai (default; built-in telephony). openai = OpenAI Realtime API (needs Twilio for telephony + OPENAI_API_KEY).';

NOTIFY pgrst, 'reload schema';
