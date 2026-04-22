-- Voice AI call campaigns
CREATE TABLE IF NOT EXISTS public.voice_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
  script_template text NOT NULL, -- the AI task prompt
  target_criteria jsonb NOT NULL DEFAULT '{}', -- filters for which leads to call
  voice_provider text NOT NULL DEFAULT 'bland', -- bland, vapi
  voice_id text DEFAULT 'nat', -- bland voice ID
  max_calls_per_day int DEFAULT 50,
  calling_hours_start text DEFAULT '09:00', -- local time
  calling_hours_end text DEFAULT '18:00',
  max_call_duration int DEFAULT 5, -- minutes
  transfer_phone text, -- number to transfer to if customer wants live person
  retry_attempts int DEFAULT 2,
  retry_delay_hours int DEFAULT 24,
  total_calls_made int DEFAULT 0,
  total_connected int DEFAULT 0,
  total_converted int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Individual call log
CREATE TABLE IF NOT EXISTS public.voice_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.voice_campaigns(id) ON DELETE SET NULL,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id uuid,

  -- Call details
  provider_call_id text, -- bland.ai call_id
  phone_number text NOT NULL,
  customer_name text,
  vehicle_info text,

  -- Timing
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds numeric,

  -- Status
  status text NOT NULL DEFAULT 'queued', -- queued, in_progress, completed, failed, no_answer, voicemail
  outcome text, -- accepted, appointment_scheduled, wants_higher_offer, callback_requested, not_interested, voicemail_left, no_answer

  -- AI data
  transcript text,
  summary text,
  recording_url text,
  answered_by text, -- human, voicemail

  -- Offer data
  original_offer numeric,
  bump_offered numeric, -- if AI offered more

  -- Retry tracking
  attempt_number int DEFAULT 1,
  retry_scheduled_at timestamptz,

  -- Compliance
  consent_verified boolean DEFAULT false,
  opt_out_requested boolean DEFAULT false,
  tcpa_disclosure_given boolean DEFAULT false,

  -- Raw
  provider_response jsonb,
  metadata jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_call_log_submission ON public.voice_call_log(submission_id);
CREATE INDEX idx_voice_call_log_campaign ON public.voice_call_log(campaign_id);
CREATE INDEX idx_voice_call_log_status ON public.voice_call_log(status);
CREATE INDEX idx_voice_call_log_scheduled ON public.voice_call_log(scheduled_at) WHERE status = 'queued';

-- Voice AI script templates
CREATE TABLE IF NOT EXISTS public.voice_script_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid,
  name text NOT NULL,
  description text,
  script_template text NOT NULL,
  category text DEFAULT 'follow_up', -- follow_up, price_bump, appointment, re_engagement
  is_default boolean DEFAULT false,
  variables jsonb DEFAULT '[]', -- available template variables
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add voice AI config to dealer_accounts
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS voice_ai_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_ai_provider text DEFAULT 'bland',
  ADD COLUMN IF NOT EXISTS voice_ai_api_key text,
  ADD COLUMN IF NOT EXISTS voice_ai_from_number text,
  ADD COLUMN IF NOT EXISTS voice_ai_transfer_number text,
  ADD COLUMN IF NOT EXISTS voice_ai_max_bump_amount numeric DEFAULT 500;

-- RLS
ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_script_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view campaigns" ON public.voice_campaigns FOR SELECT USING (true);
CREATE POLICY "Admin can manage campaigns" ON public.voice_campaigns FOR ALL USING (true);
CREATE POLICY "Staff can view call log" ON public.voice_call_log FOR SELECT USING (true);
CREATE POLICY "Service can insert calls" ON public.voice_call_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update calls" ON public.voice_call_log FOR UPDATE USING (true);
CREATE POLICY "Anyone can read templates" ON public.voice_script_templates FOR SELECT USING (true);
CREATE POLICY "Admin can manage templates" ON public.voice_script_templates FOR ALL USING (true);

-- Seed default script templates
INSERT INTO public.voice_script_templates (name, description, script_template, category, is_default, variables) VALUES
(
  'Offer Follow-Up',
  'First call to customers who received an offer but haven''t accepted',
  'You are {{agent_name}} calling from {{dealer_name}}. You are calling {{customer_first_name}} about their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}.

COMPLIANCE (say this FIRST): "This is {{agent_name}} from {{dealer_name}} at {{dealer_phone}}. This call uses AI-assisted technology. You can say stop at any time to be removed from our call list."

CONTEXT: The customer submitted their vehicle for an offer and received ${{offer_amount}}, but they haven''t accepted yet. The offer is valid for {{days_remaining}} more days.

YOUR GOAL: Get the customer to either:
1. Accept the current offer and schedule an appointment
2. Come in for an in-person appraisal where we can often do better

CONVERSATION FLOW:
- Greet them warmly by name
- Reference their specific vehicle and the offer they received
- Ask if they are still considering selling
- If yes: emphasize convenience (we handle everything, get paid same day), mention the offer expires in {{days_remaining}} days
- If they want more money: say "I completely understand. Our in-person appraisals often come in higher because our team can see the real condition. Would you be open to a quick 15-minute visit? There is no obligation."
- If they mention CarMax or Carvana: say "We actually match or beat those offers because we retail vehicles — we are not wholesaling to auction like they do. Plus you are dealing with a local business you can trust."
- If they want to schedule: offer {{available_days}} and ask morning or afternoon
- If not interested: be respectful, thank them, and say their offer link stays active if they change their mind

RULES:
- Be warm, friendly, and conversational — NOT robotic or pushy
- Never pressure or guilt trip
- If they say "stop calling" or "remove me" — immediately say "Absolutely, I have removed you from our list. Have a great day." and end the call
- If they want to speak to a real person, say "Let me connect you with our team right now" and transfer
- Keep the call under 3 minutes unless the customer is engaged
- Do NOT make promises about specific dollar amounts for a bump — just say "our team often does better in person"',
  'follow_up',
  true,
  '[{"key": "agent_name", "label": "AI Agent Name"}, {"key": "dealer_name", "label": "Dealership Name"}, {"key": "dealer_phone", "label": "Dealer Phone"}, {"key": "customer_first_name", "label": "Customer First Name"}, {"key": "vehicle_year", "label": "Vehicle Year"}, {"key": "vehicle_make", "label": "Vehicle Make"}, {"key": "vehicle_model", "label": "Vehicle Model"}, {"key": "offer_amount", "label": "Offer Amount"}, {"key": "days_remaining", "label": "Days Until Expiry"}, {"key": "available_days", "label": "Available Days"}]'
),
(
  'Price Bump Offer',
  'Call with authority to offer up to $500 more to close the deal',
  'You are {{agent_name}} calling from {{dealer_name}}. You are calling {{customer_first_name}} about their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}.

COMPLIANCE (say this FIRST): "This is {{agent_name}} from {{dealer_name}} at {{dealer_phone}}. This call uses AI-assisted technology. You can say stop at any time to be removed from our call list."

CONTEXT: This customer previously received an offer of ${{offer_amount}} but did not accept. Your manager has authorized you to offer up to ${{max_bump}} more to close the deal. The current authorized offer is ${{bumped_amount}}.

YOUR GOAL: Close the deal by offering the higher amount, or at minimum get them to come in for an in-person appraisal.

CONVERSATION FLOW:
- Greet them warmly
- Say: "I have some good news. I spoke with my manager about your {{vehicle_year}} {{vehicle_make}} and we were able to get your offer increased."
- Reveal the new amount: "We can now offer you ${{bumped_amount}} for your vehicle."
- If they accept: "Wonderful! Let me get you scheduled for a quick visit. We can have a check ready the same day. Would {{available_days}} work?"
- If they still want more: "I understand. The best I can do over the phone is ${{bumped_amount}}, but if you come in for a 15-minute appraisal, our acquisition manager has more flexibility in person. No obligation — you can always say no."
- If not interested: respect it, leave the door open

RULES:
- Only reveal the bumped amount, never the maximum
- Be excited about the "good news" — this is a positive call
- Never go above ${{bumped_amount}} on the phone
- If they want to speak to a real person, transfer immediately
- Honor opt-outs immediately',
  'price_bump',
  true,
  '[{"key": "agent_name", "label": "AI Agent Name"}, {"key": "dealer_name", "label": "Dealership Name"}, {"key": "dealer_phone", "label": "Dealer Phone"}, {"key": "customer_first_name", "label": "Customer First Name"}, {"key": "vehicle_year", "label": "Vehicle Year"}, {"key": "vehicle_make", "label": "Vehicle Make"}, {"key": "vehicle_model", "label": "Vehicle Model"}, {"key": "offer_amount", "label": "Original Offer"}, {"key": "max_bump", "label": "Max Bump"}, {"key": "bumped_amount", "label": "Bumped Offer"}, {"key": "available_days", "label": "Available Days"}]'
),
(
  'Re-engagement (30+ days)',
  'Reach out to stale leads who submitted 30+ days ago',
  'You are {{agent_name}} calling from {{dealer_name}}. You are calling {{customer_first_name}} about their {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}.

COMPLIANCE (say this FIRST): "This is {{agent_name}} from {{dealer_name}} at {{dealer_phone}}. This call uses AI-assisted technology. You can say stop at any time to be removed from our call list."

CONTEXT: This customer submitted their vehicle over 30 days ago. Market conditions may have changed. You are checking in to see if they are still interested.

CONVERSATION FLOW:
- "Hi {{customer_first_name}}, this is {{agent_name}} from {{dealer_name}}. You reached out to us a while back about your {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}. I just wanted to check in — is that something you are still thinking about?"
- If yes: "Great news — the market has been moving and your vehicle may actually be worth more now. Would you like us to run a fresh offer for you? It only takes a couple minutes."
- If already sold: "No problem at all! If you ever have another vehicle, we are always here. Have a great day."
- If not interested: thank them and end gracefully

RULES:
- This is a soft touch — do NOT hard sell
- Keep it under 2 minutes
- Goal is just to re-engage, not close on this call',
  're_engagement',
  true,
  '[{"key": "agent_name", "label": "AI Agent Name"}, {"key": "dealer_name", "label": "Dealership Name"}, {"key": "dealer_phone", "label": "Dealer Phone"}, {"key": "customer_first_name", "label": "Customer First Name"}, {"key": "vehicle_year", "label": "Vehicle Year"}, {"key": "vehicle_make", "label": "Vehicle Make"}, {"key": "vehicle_model", "label": "Vehicle Model"}]'
)
ON CONFLICT DO NOTHING;
