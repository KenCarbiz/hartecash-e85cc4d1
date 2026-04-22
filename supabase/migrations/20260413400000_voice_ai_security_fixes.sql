-- Fix 1: Add unique constraint on provider_call_id to prevent duplicate webhook processing
ALTER TABLE public.voice_call_log
  ADD CONSTRAINT voice_call_log_provider_call_id_unique UNIQUE (provider_call_id);

-- Fix 2: Fix overly permissive RLS policies on voice tables
-- Drop the too-broad policies
DROP POLICY IF EXISTS "Staff can view campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Admin can manage campaigns" ON public.voice_campaigns;
DROP POLICY IF EXISTS "Staff can view call log" ON public.voice_call_log;
DROP POLICY IF EXISTS "Service can insert calls" ON public.voice_call_log;
DROP POLICY IF EXISTS "Service can update calls" ON public.voice_call_log;

-- Recreate with dealership_id scoping
-- For voice_campaigns: staff can only see their own dealership's campaigns
CREATE POLICY "Staff can view own campaigns" ON public.voice_campaigns
  FOR SELECT USING (
    dealership_id IN (
      SELECT dealership_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage own campaigns" ON public.voice_campaigns
  FOR ALL USING (
    dealership_id IN (
      SELECT dealership_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'gsm_gm')
    )
  );

-- For voice_call_log: staff can only see their own dealership's calls
CREATE POLICY "Staff can view own call log" ON public.voice_call_log
  FOR SELECT USING (
    dealership_id IN (
      SELECT dealership_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role (edge functions) can insert and update call logs
CREATE POLICY "Service can insert calls" ON public.voice_call_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update calls" ON public.voice_call_log
  FOR UPDATE USING (true);

-- Fix 3: Add missing fields for better tracking
ALTER TABLE public.voice_call_log
  ADD COLUMN IF NOT EXISTS warmup_sms_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_call_sms_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_sentiment text;

-- Fix 4: Add voicemail_message to campaigns
ALTER TABLE public.voice_campaigns
  ADD COLUMN IF NOT EXISTS voicemail_message text,
  ADD COLUMN IF NOT EXISTS warmup_sms_enabled boolean DEFAULT true;
