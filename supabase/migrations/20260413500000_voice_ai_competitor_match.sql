-- Competitor offer match/beat configuration
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS voice_ai_match_competitors boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_ai_beat_competitor_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voice_ai_competitor_response_mode text DEFAULT 'none';
  -- Modes: 'none' (don't match), 'match' (match their offer), 'beat' (beat by X amount)
