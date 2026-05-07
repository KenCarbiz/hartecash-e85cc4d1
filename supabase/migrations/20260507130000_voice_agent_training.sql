-- Voice agent training cabinet — four tables that compile into the
-- Bland.ai (or Vapi/Retell) system prompt at call-start.
--
-- Layers:
--   voice_agent_persona   — who the AI is, hard rules, mission
--   conversation_phases   — openings, transitions, closings keyed
--                            by call_type and phase_position
--   customer_signals      — phrases + tonal markers → recommended
--                            posture + response variants
--   industry_intel        — citable facts (numbers + sources) the
--                            AI quotes when challenged. Includes
--                            competitor intel under scope='competitor'
--                            but the AI ONLY cites them when the
--                            customer brings the competitor up.
--
-- Plus the compile_voice_agent_prompt(_dealership_id, _submission_id)
-- RPC that pulls everything (persona + phases + signals + intel +
-- objection playbook + live submission context) into a single
-- prompt block the voice provider injects at call-start.
--
-- Per-tenant overrides: each table has dealership_id with 'default'
-- as the network-shared row. Tenant rows on the same key (e.g.
-- objection_key, signal_key) override defaults.
--
-- Idempotent. Safe to re-run.

-- ── voice_agent_persona ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_agent_persona (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  persona_name text NOT NULL,                    -- "Mike, BDC at {{dealership_name}}"
  voice_rules text NOT NULL,                      -- hard rules ("contractions ok, no superlatives")
  mission_block text NOT NULL,                    -- the why-now framing
  success_criteria text NOT NULL,                 -- what "good" looks like per call
  hard_constraints text[] NOT NULL DEFAULT '{}',  -- list of inviolable rules
  greeting_style text,
  signoff_style text,
  ai_disclosure_line text,                        -- mandatory FCC AI-call self-disclosure
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, persona_name)
);

ALTER TABLE public.voice_agent_persona ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage own tenant persona" ON public.voice_agent_persona;
CREATE POLICY "Admins manage own tenant persona"
  ON public.voice_agent_persona FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));
DROP POLICY IF EXISTS "Public read default persona" ON public.voice_agent_persona;
CREATE POLICY "Public read default persona"
  ON public.voice_agent_persona FOR SELECT TO public
  USING (dealership_id = 'default' AND is_active = true);
DROP POLICY IF EXISTS "Staff read own persona" ON public.voice_agent_persona;
CREATE POLICY "Staff read own persona"
  ON public.voice_agent_persona FOR SELECT TO authenticated
  USING (dealership_id = get_user_dealership_id(auth.uid()) OR dealership_id = 'default');

-- ── conversation_phases ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  phase_key text NOT NULL,                        -- "opening_offer_followup"
  call_type text NOT NULL,                        -- "offered_to_accepted" etc.
  phase_position text NOT NULL,                   -- "open" | "middle" | "close"
  variant_label text NOT NULL,                    -- "warm_direct" | "consultative"
  content text NOT NULL,                          -- the actual lines the AI says
  signal_keywords text[] NOT NULL DEFAULT '{}',   -- words that should trigger this phase
  use_when text,
  advances_to text,                                -- next phase_key on success
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, phase_key, variant_label)
);

ALTER TABLE public.conversation_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage own tenant phases" ON public.conversation_phases;
CREATE POLICY "Admins manage own tenant phases"
  ON public.conversation_phases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));
DROP POLICY IF EXISTS "Public read default phases" ON public.conversation_phases;
CREATE POLICY "Public read default phases"
  ON public.conversation_phases FOR SELECT TO public
  USING (dealership_id = 'default' AND is_active = true);
DROP POLICY IF EXISTS "Staff read own phases" ON public.conversation_phases;
CREATE POLICY "Staff read own phases"
  ON public.conversation_phases FOR SELECT TO authenticated
  USING (dealership_id = get_user_dealership_id(auth.uid()) OR dealership_id = 'default');

-- ── customer_signals ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  signal_key text NOT NULL,                       -- "ready_to_book", "stalling_thinking"
  signal_phrases text[] NOT NULL DEFAULT '{}',     -- "when can I come in", etc.
  customer_state text NOT NULL,                    -- ready | stalling | hostile | confused | walking | negotiating
  recommended_posture text NOT NULL,
  response_variants text[] NOT NULL DEFAULT '{}',
  do_not_say text[] NOT NULL DEFAULT '{}',
  hand_off_to_human boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, signal_key)
);

ALTER TABLE public.customer_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage own tenant signals" ON public.customer_signals;
CREATE POLICY "Admins manage own tenant signals"
  ON public.customer_signals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));
DROP POLICY IF EXISTS "Public read default signals" ON public.customer_signals;
CREATE POLICY "Public read default signals"
  ON public.customer_signals FOR SELECT TO public
  USING (dealership_id = 'default' AND is_active = true);
DROP POLICY IF EXISTS "Staff read own signals" ON public.customer_signals;
CREATE POLICY "Staff read own signals"
  ON public.customer_signals FOR SELECT TO authenticated
  USING (dealership_id = get_user_dealership_id(auth.uid()) OR dealership_id = 'default');

-- ── industry_intel ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.industry_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  scope text NOT NULL,                            -- "industry" | "competitor" | "vehicle_class" | "regional"
  topic text NOT NULL,
  short_claim text NOT NULL,                       -- the citable line
  citable_number text,                             -- the number, quoted verbatim
  evidence_url text,
  last_verified_at timestamptz,
  use_when text,                                   -- when the AI brings this up
  applies_to_segments text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, scope, topic)
);

ALTER TABLE public.industry_intel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage own tenant intel" ON public.industry_intel;
CREATE POLICY "Admins manage own tenant intel"
  ON public.industry_intel FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));
DROP POLICY IF EXISTS "Public read default intel" ON public.industry_intel;
CREATE POLICY "Public read default intel"
  ON public.industry_intel FOR SELECT TO public
  USING (dealership_id = 'default' AND is_active = true);
DROP POLICY IF EXISTS "Staff read own intel" ON public.industry_intel;
CREATE POLICY "Staff read own intel"
  ON public.industry_intel FOR SELECT TO authenticated
  USING (dealership_id = get_user_dealership_id(auth.uid()) OR dealership_id = 'default');

-- ── Seed default persona ─────────────────────────────────────────
INSERT INTO public.voice_agent_persona
  (dealership_id, persona_name, voice_rules, mission_block,
   success_criteria, hard_constraints, greeting_style,
   signoff_style, ai_disclosure_line, sort_order)
VALUES
  ('default',
   'Acquisition Specialist',
   E'Use contractions. Skip marketing superlatives ("amazing", "incredible"). Never name a competitor proactively — only respond when the customer names one. No bulleted lists when speaking — short sentences, natural pauses. Confirmations: "got it," "sure thing," "no problem." Match the customer''s energy. If they''re rushed, be direct. If they''re hesitant, slow down.',
   E'Industry data shows the average from first appraisal to check in hand runs 3-4 weeks when there''s a loan involved. The fastest deals close in 5-7 days. The whole difference is whether the customer''s payoff authorization and co-signer''s signature are in motion today instead of next week. Speed is a courtesy, not pressure. Your job is to remove every reason the customer would delay so they can say yes today — without ever being pushy.',
   'Either book the inspection appointment OR get the real, named objection so the BDC team can work it. A clear "no" is a better outcome than a vague "maybe."',
   ARRAY[
     'Honor STOP / opt-out keywords instantly and end the call',
     'Disclose AI status when the customer asks',
     'Never claim an offer expires unless it actually does',
     'Never name a competitor unless the customer named them first',
     'Never quote a number you don''t have grounded data for',
     'Hand off to a human on legal questions, hostility threats, or anything outside the playbook',
     'Quiet hours: no calls 9pm-8am customer-local'
   ],
   E'Warm but direct. Identify yourself in the first sentence: "Hi {{customer_first_name}}, this is {{persona_name}} calling from {{dealership_name}} about your {{vehicle}}." Reference something specific the customer submitted (the VIN, year/make/model) so they know it''s not cold spam.',
   E'Always offer a callback time you''ll keep. Never end on "hope to hear from you soon" — set the next touch.',
   E'I''m an AI assistant on the acquisition team. I can answer most questions and book the inspection — and I''ll grab a human teammate any time you want.',
   0)
ON CONFLICT (dealership_id, persona_name) DO NOTHING;

-- ── Seed industry intel — anchored in May 2026 voice-AI-training research ──
INSERT INTO public.industry_intel
  (dealership_id, scope, topic, short_claim, citable_number,
   evidence_url, use_when, sort_order)
VALUES
  ('default','industry','days_to_acquisition',
   'Average from first appraisal to check in hand is 3-4 weeks when a loan is involved. Fastest deals close in 5-7 days.',
   '5-7 days fastest, 3-4 weeks typical with loan',
   'https://www.edmunds.com/industry-center/data/days-to-turn.html',
   'When the customer wonders "how long does this take" or stalls on timing.',
   10),
  ('default','industry','manheim_index',
   'Wholesale auction prices move 0.3-0.6% week-over-week on the Manheim Used Vehicle Value Index.',
   '0.3-0.6% weekly drift; April 2026 index 213.0',
   'https://www.coxautoinc.com/insights/manheim-used-vehicle-value-index-mid-april-2026-trends/',
   'When the customer questions why the offer can''t wait.',
   20),
  ('default','industry','negative_equity',
   '29.3% of vehicles being traded nationally currently carry an active loan with a balance higher than the car is worth. Average gap is $7,214.',
   '29.3% underwater, $7,214 average gap',
   'https://www.edmunds.com/car-news/edmunds-q4-2025-insights-report.html',
   'When the customer says they owe more than the car is worth — leads with the data so they know they''re not unusual.',
   30),
  ('default','industry','payoff_letter_timing',
   'Federal rule: lenders have 7 business days to issue a payoff letter. Captive lenders (Toyota Financial, Ford Credit, BMW FS) often respond same-day. Banks: 2-5 business days. Credit unions: 10 business days plus a hold before lien release.',
   'Captive same-day, banks 2-5 days, credit unions 10 days',
   'https://www.thebalancemoney.com/payoff-letter-basics-315691',
   'When explaining to the customer how the loan-payoff timeline actually works.',
   40),
  ('default','industry','recon_cost',
   'Average reconditioning cost on a used vehicle for a dealer is around $1,112 per unit.',
   '$1,112 average recon',
   'https://www.amerifreight.net/blog/how-much-do-dealers-markup-used-cars',
   'When justifying why retail asking price is higher than the buy number — the dealer eats the recon, certification, and detail costs.',
   50),
  ('default','industry','private_sale_market_time',
   'Private-party listings typically take 30-60 days to sell.',
   '30-60 days private-party',
   'https://www.kbb.com/sell-your-car/private-party-vs-trade-in/',
   'When the customer says they''ll just sell it private.',
   60),
  ('default','industry','open_title_risk',
   'When you sign your title to a private buyer who doesn''t immediately register the vehicle, YOU stay registered as the owner. Tickets, tolls, accidents, and abandoned-vehicle fines come back to you until the buyer registers — sometimes for months. State DMVs report hundreds of these cases annually per state.',
   'Hundreds of cases per state per year',
   'https://abc7chicago.com/amp/car-title-missing-used-sell-without/4387126/',
   'When the customer is considering a private sale — open-title is the single biggest under-known liability.',
   70),
  ('default','competitor','online_wholesale_share',
   'Major online vehicle buyers wholesale 30-40% of what they take in — most cars are flipped to other dealers at auction within a week or two of purchase.',
   '30-40% wholesaled',
   'https://www.sec.gov/Archives/edgar/data/1170010/000117001025000068/kmxfy25annualreport.pdf',
   'ONLY when the customer names an online buyer first. Use to explain why the offer they got might not survive their inspection / where their title chain ends up.',
   100),
  ('default','competitor','online_inspection_revisions',
   'Some online vehicle buyers condition their offer on a separate inspection at pickup. Reductions are case-by-case and unpublished. Once their truck is in your driveway, the negotiating leverage shifts to them.',
   NULL,
   'https://www.thevantagegroupauto.com/blog/does-carvana-change-offer-after-inspection',
   'ONLY when the customer raises an online buyer''s offer.',
   110),
  ('default','competitor','vroom_wound_down',
   'Vroom shut down their consumer vehicle business in January 2024. Any offer from them today is not valid.',
   'Wind-down completed April 2024',
   'https://ir.vroom.com/news-releases/news-release-details/vroom-announces-wind-down-ecommerce-used-vehicle-operations',
   'ONLY when the customer cites Vroom — happens rarely now but the AI shouldn''t engage as if Vroom is still a competitor.',
   120),
  ('default','competitor','kbb_ico_haircut',
   'The Kelley Blue Book Instant Cash Offer is a dealer-network number — typically 5-15% below KBB''s consumer-facing trade-in range.',
   '5-15% under consumer trade-in range',
   'https://b2b.kbb.com/resources/case-studies-in-confidence/',
   'When the customer compares our offer to "what KBB said the car is worth" — distinguish the consumer trade-in number from the dealer-network instant offer.',
   130)
ON CONFLICT (dealership_id, scope, topic) DO NOTHING;

-- ── Seed customer signals ────────────────────────────────────────
INSERT INTO public.customer_signals
  (dealership_id, signal_key, signal_phrases, customer_state,
   recommended_posture, response_variants, do_not_say,
   hand_off_to_human, sort_order)
VALUES
  ('default', 'ready_to_book',
   ARRAY['when can I come in','what time','where do I sign','let''s do it','what do you need from me'],
   'ready',
   'Confirm + close. Book the inspection slot in the same breath. Do not re-pitch.',
   ARRAY[
     'Awesome. I''ve got a slot Saturday at 10:30 or Thursday at 4:15 — which works?',
     'Great. Two openings I can hold for you: tomorrow at 11:00, or Friday at 2:00.'
   ],
   ARRAY['Just one more thing','Before we book','Are you sure you''re ready'],
   false, 10),
  ('default', 'stalling_thinking',
   ARRAY['let me think','let me sleep on it','I''ll get back to you','need to think it over','not in a rush'],
   'stalling',
   'Surface the real objection. They''re not telling you something. Ask one question to find it.',
   ARRAY[
     'Of course — totally fair. Usually when folks say that, it means I haven''t fully answered something. What''s the one thing still hanging?',
     'Take whatever time you need. Quick — was there one number or one piece of paperwork you wanted to look at again?'
   ],
   ARRAY['Don''t miss out','Last chance','You''ll regret it'],
   false, 20),
  ('default', 'hostile_lowball',
   ARRAY['that''s insulting','you''re trying to rip me off','my car is worth way more','you''re lowballing'],
   'hostile',
   'Validate. Don''t argue. Cite the wholesale-market data and offer the comp grid.',
   ARRAY[
     'That reaction tells me the number landed lower than you expected. The wholesale market dropped about 1% this month — let me walk through how we got there.',
     'I hear you. Five same-trim cars sold at auction this week — I can text you those comps so you see the math.'
   ],
   ARRAY['Calm down','You''re being unreasonable','Take it or leave it'],
   false, 30),
  ('default', 'confused_jargon',
   ARRAY['what''s a payoff','what does lien release mean','what''s negative equity','what''s ACV'],
   'confused',
   'Plain-language define + check for understanding. Never assume.',
   ARRAY[
     'Good question — payoff is the exact dollar amount your lender needs to clear the loan. We get it in writing from them; takes anywhere from same-day to 10 business days depending on who you''re with.',
     'No problem — the lien is just the lender''s claim on the title. They release it once the loan is paid; we handle that on our end so you don''t have to.'
   ],
   ARRAY['Obviously','Everyone knows','You should know'],
   false, 40),
  ('default', 'walking_private_sale',
   ARRAY['I''ll sell it private','craigslist','facebook marketplace','my nephew might want it','I''ll list it myself'],
   'walking',
   'Acknowledge the price upside, then quantify the time, fraud, and open-title risk. Don''t fight the choice.',
   ARRAY[
     'You can probably get a higher headline number — that part''s real. But heads up: private-party listings average 30 to 60 days to sell. And when you sign the title to a buyer who doesn''t register it, YOU stay liable for tickets and accidents until they do.',
     'Sure, that''s an option. One thing folks don''t always think about — open title. Until your buyer registers the car, you''re the registered owner. So if they crash on the way home, your insurance is on the hook.'
   ],
   ARRAY['You''ll regret it','Private buyers are dangerous','Don''t be stupid'],
   false, 50),
  ('default', 'comparing_competitor',
   ARRAY['offered me more','better offer','higher offer'],
   'negotiating',
   'Match the conversation only when the customer names the competitor. Pull from industry_intel scope=competitor for facts. Offer to compare in writing.',
   ARRAY[
     'I''d love to look at that side by side. Got the offer in writing? If you can text or email it over, I''ll see what we can do.',
     'Sure — let me see their number. I''m not going to argue without seeing it. If we''re close, we can probably make this work.'
   ],
   ARRAY['That''s a bad number','They''re lying to you','They wholesale everything'],
   false, 60),
  ('default', 'co_decider',
   ARRAY['my spouse','my wife','my husband','my partner','my dad','I have to talk to'],
   'negotiating',
   'Invite the co-decider onto the call now. Don''t pressure unilateral acceptance.',
   ARRAY[
     'Totally — half the cars I help with are co-titled. Is she around for two minutes? Easier to answer her questions live than play telephone.',
     'Makes sense. Want me to text you a one-page summary you can show him? And I can hold a Saturday slot — cancel-free if it doesn''t work for both.'
   ],
   ARRAY['You can decide on your own','Don''t need their permission'],
   false, 70),
  ('default', 'payoff_anxiety',
   ARRAY['I owe more than','upside down','underwater','negative equity','will you pay off the loan'],
   'negotiating',
   'Lead with the 29.3% statistic so they don''t feel alone. Walk through the gap-coverage path.',
   ARRAY[
     'You''re not alone — about 29% of trades right now are underwater, average gap''s about $7,200. Let''s get the exact payoff letter from your lender so we know the real number.',
     'Heads up — that''s super common. Let''s get your lender to send the 10-day payoff so we know the gap. Sometimes it''s smaller than people think because of unearned interest.'
   ],
   ARRAY['That''s your problem','Should have made better choices','Why did you finance so much'],
   false, 80),
  ('default', 'urgency_today',
   ARRAY['need cash today','need money','emergency','today only'],
   'ready',
   'Match urgency. Honest about what same-day requires.',
   ARRAY[
     'I hear you. Same-day check works — bring the car, ID, title or your lender authorization, all keys. Most people are in and out in 30 to 45 minutes. What''s the earliest you can be here?',
     'Got it. We can do same-day if title''s in your hand or your lender''s captive. What''s your earliest window today?'
   ],
   ARRAY['Slow down','Are you sure','That''s a lot of pressure'],
   false, 90),
  ('default', 'cool_off_regret',
   ARRAY['not sure I should sell','maybe I''ll keep it','my kid might need','having second thoughts'],
   'stalling',
   'Don''t push. Lock the price for 7 days. Ask what would change.',
   ARRAY[
     'Totally fair. The 7-day lock means you can call me back Friday and the number''s still good. What would change between now and Friday?',
     'No pressure. Want me to lock the number for the week and you can ping me if it makes sense?'
   ],
   ARRAY['You''ll regret it','We can''t hold this forever','This is a one-time offer'],
   false, 100),
  ('default', 'asking_if_ai',
   ARRAY['are you a person','are you human','are you a real person','am I talking to AI','is this a bot'],
   'confused',
   'Disclose proactively. Never lie. Offer the human handoff.',
   ARRAY[
     'I''m an AI assistant on the acquisition team. I can answer most questions and book the inspection — and I''ll grab a human teammate any time you want one.',
     'Yeah, I''m AI — full disclosure. I can handle the basics and the appointment. Want me to grab a human?'
   ],
   ARRAY['Yes I''m human','I''m a real person','Of course I''m a person'],
   false, 110)
ON CONFLICT (dealership_id, signal_key) DO NOTHING;

-- ── Seed conversation phases ─────────────────────────────────────
INSERT INTO public.conversation_phases
  (dealership_id, phase_key, call_type, phase_position,
   variant_label, content, signal_keywords, use_when,
   advances_to, sort_order)
VALUES
  ('default', 'opening_offer_followup', 'offered_to_accepted', 'open',
   'warm_direct',
   E'Hi {{customer_first_name}}, this is {{persona_name}} calling from {{dealership_name}} about your {{vehicle}}. We sent over an offer of {{offer_amount}}. Did you have a chance to look at it, and is there anything I can clear up?',
   ARRAY[]::text[],
   'First call after offer presentation, customer hasn''t engaged with the portal in 1+ hours.',
   'middle_objection_probe', 10),
  ('default', 'opening_offer_followup', 'offered_to_accepted', 'open',
   'consultative',
   E'Hi {{customer_first_name}}, {{persona_name}} from {{dealership_name}}. I''ve got the file open on your {{vehicle}} — wanted to check in and see if the number we sent over made sense or if you had any questions.',
   ARRAY[]::text[],
   'Same trigger, gentler tone for customers flagged as price-sensitive or skeptical.',
   'middle_objection_probe', 20),
  ('default', 'opening_appointment_followup', 'accepted_to_appointment', 'open',
   'warm_direct',
   E'Hi {{customer_first_name}}, this is {{persona_name}} from {{dealership_name}}. You accepted on the {{vehicle}} a couple hours ago — thanks for that. Last step is picking a 20-minute window to bring it by. Got time tomorrow or want to do later in the week?',
   ARRAY[]::text[],
   'Customer accepted, no inspection slot booked within 2 hours.',
   'middle_book_slot', 30),
  ('default', 'opening_declined_winback', 'declined_winback', 'open',
   'curious',
   E'Hi {{customer_first_name}}, {{persona_name}} from {{dealership_name}}. I saw the offer on your {{vehicle}} didn''t move forward. I''m not calling to push — just curious what didn''t work, so we know how to follow up the right way going forward. Was it the number, the timing, or something else?',
   ARRAY[]::text[],
   'Customer declined the offer 72+ hours ago, no specific reason captured.',
   'middle_objection_probe', 40),
  ('default', 'opening_no_answer_followup', 'no_answer_followup', 'open',
   'warm_direct',
   E'Hi {{customer_first_name}}, this is {{persona_name}} from {{dealership_name}} calling back about your {{vehicle}}. Just wanted to make sure you got the offer we sent over. Quick call — is now an okay time?',
   ARRAY[]::text[],
   'Customer didn''t answer the prior attempt; this is the second voice attempt.',
   'middle_objection_probe', 50),
  ('default', 'middle_objection_probe', 'offered_to_accepted', 'middle',
   'standard',
   E'Got it. So when you say [match the customer''s objection], can you say more about what would make this work for you? I want to make sure I understand before I respond.',
   ARRAY[]::text[],
   'After opening, before the close. Surfaces the real objection by reflecting back what the customer said.',
   'closing_book_or_callback', 60),
  ('default', 'middle_book_slot', 'accepted_to_appointment', 'middle',
   'standard',
   E'I''ve got two slots open — {{slot_1}} or {{slot_2}}. Either of those work? If neither does, tell me your window and I''ll find something close.',
   ARRAY[]::text[],
   'Customer is moving toward booking; pin a specific time.',
   'closing_appointment_confirmed', 70),
  ('default', 'closing_book_or_callback', 'offered_to_accepted', 'close',
   'standard',
   E'Sounds good. Do you want to lock in a time for the inspection now while we''re on the phone — or want me to give you a callback day-after-tomorrow once you''ve had a chance to think about it?',
   ARRAY[]::text[],
   'Customer hasn''t fully committed but isn''t walking. Forced choice between booking and a real callback.',
   NULL, 80),
  ('default', 'closing_appointment_confirmed', 'accepted_to_appointment', 'close',
   'standard',
   E'Perfect — {{slot_chosen}} is booked. You''ll get a confirmation text in a minute, and I''ll text you the day-of with check-in instructions. Bring your driver''s license, the title or registration, and all keys. Anything else I can answer right now?',
   ARRAY[]::text[],
   'Slot has been picked; confirm and end on a specific next-step.',
   NULL, 90),
  ('default', 'closing_no_decision', 'offered_to_accepted', 'close',
   'standard',
   E'Totally fair — no pressure either way. The number''s locked for 7 days, and if you want to revisit, just text or call me back. {{rep_name_short}} at {{dealership_name}}. Have a good one.',
   ARRAY[]::text[],
   'Customer is not ready to decide. End cleanly without pressure; mention the 7-day lock.',
   NULL, 100)
ON CONFLICT (dealership_id, phase_key, variant_label) DO NOTHING;

-- ── compile_voice_agent_prompt RPC ───────────────────────────────
-- Pulls all four cabinet layers + the objection playbook + live
-- submission context into one text block. Bland.ai (or Vapi/Retell)
-- takes this as its system prompt at call-start. Tenant overrides
-- on objection_key / signal_key / phase_key / persona_name win
-- over network defaults.
CREATE OR REPLACE FUNCTION public.compile_voice_agent_prompt(
  _dealership_id text DEFAULT 'default',
  _submission_id uuid DEFAULT NULL,
  _call_type     text DEFAULT 'offered_to_accepted'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _persona  record;
  _block    text := '';
  _r        record;
  _sub      record;
BEGIN
  -- Persona (tenant override → default fallback)
  SELECT * INTO _persona
  FROM voice_agent_persona
  WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
    AND is_active = true
  ORDER BY CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END, sort_order
  LIMIT 1;

  IF _persona.id IS NULL THEN
    RETURN E'No voice agent persona configured.';
  END IF;

  _block := _block || E'═══ PERSONA ═══\nYou are: ' || _persona.persona_name || E'\n\n';
  _block := _block || E'VOICE RULES:\n' || _persona.voice_rules || E'\n\n';
  _block := _block || E'MISSION:\n' || _persona.mission_block || E'\n\n';
  _block := _block || E'SUCCESS LOOKS LIKE:\n' || _persona.success_criteria || E'\n\n';
  IF _persona.greeting_style IS NOT NULL THEN
    _block := _block || E'GREETING STYLE:\n' || _persona.greeting_style || E'\n\n';
  END IF;
  IF _persona.signoff_style IS NOT NULL THEN
    _block := _block || E'SIGN-OFF STYLE:\n' || _persona.signoff_style || E'\n\n';
  END IF;
  _block := _block || E'AI DISCLOSURE (when asked):\n' || COALESCE(_persona.ai_disclosure_line, '') || E'\n\n';
  _block := _block || E'HARD CONSTRAINTS:\n';
  FOR i IN 1..COALESCE(array_length(_persona.hard_constraints, 1), 0) LOOP
    _block := _block || '- ' || _persona.hard_constraints[i] || E'\n';
  END LOOP;
  _block := _block || E'\n';

  -- Conversation phases for this call type
  _block := _block || E'═══ CONVERSATION PHASES ═══\n';
  FOR _r IN
    SELECT * FROM conversation_phases
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND call_type = _call_type
      AND is_active = true
    ORDER BY
      CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END,
      sort_order
  LOOP
    _block := _block || E'\n[' || _r.phase_position || ' · ' || _r.phase_key || ']\n';
    _block := _block || _r.content || E'\n';
    IF _r.use_when IS NOT NULL THEN
      _block := _block || '  USE WHEN: ' || _r.use_when || E'\n';
    END IF;
  END LOOP;
  _block := _block || E'\n';

  -- Customer signals — the AI listens for these and adjusts posture
  _block := _block || E'═══ CUSTOMER SIGNALS ═══\nMatch the customer''s words to one of these states and use the recommended response.\n';
  FOR _r IN
    SELECT * FROM customer_signals
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
    ORDER BY
      CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END,
      sort_order
  LOOP
    _block := _block || E'\n— Signal: ' || _r.signal_key || ' (state: ' || _r.customer_state || E')\n';
    _block := _block || '  If they say: ' || array_to_string(_r.signal_phrases, ', ') || E'\n';
    _block := _block || '  Posture: ' || _r.recommended_posture || E'\n';
    IF array_length(_r.response_variants, 1) > 0 THEN
      _block := _block || '  Say something like: ' || _r.response_variants[1] || E'\n';
    END IF;
    IF array_length(_r.do_not_say, 1) > 0 THEN
      _block := _block || '  Do NOT say: ' || array_to_string(_r.do_not_say, ' / ') || E'\n';
    END IF;
    IF _r.hand_off_to_human THEN
      _block := _block || E'  → HAND OFF TO HUMAN immediately.\n';
    END IF;
  END LOOP;
  _block := _block || E'\n';

  -- Industry intel — citable facts
  _block := _block || E'═══ CITABLE FACTS ═══\nUse these when the customer challenges a claim. Quote the number, do not paraphrase. Competitor entries fire ONLY when the customer names the competitor first.\n';
  FOR _r IN
    SELECT * FROM industry_intel
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
    ORDER BY
      CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END,
      scope, sort_order
  LOOP
    _block := _block || E'\n[' || _r.scope || ' · ' || _r.topic || E']\n';
    _block := _block || '  ' || _r.short_claim || E'\n';
    IF _r.citable_number IS NOT NULL THEN
      _block := _block || '  Number: ' || _r.citable_number || E'\n';
    END IF;
    IF _r.use_when IS NOT NULL THEN
      _block := _block || '  Use when: ' || _r.use_when || E'\n';
    END IF;
  END LOOP;
  _block := _block || E'\n';

  -- Objection playbook — short summary, voice snippets
  _block := _block || E'═══ OBJECTION PLAYBOOK ═══\nCompiled from objection_playbook. Match customer phrases to the right card.\n';
  FOR _r IN
    SELECT label, customer_signals, voice_ai_snippet
    FROM objection_playbook
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
      AND voice_ai_snippet IS NOT NULL
    ORDER BY
      CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END,
      sort_order
  LOOP
    _block := _block || E'\n— If they say something like '
      || array_to_string(_r.customer_signals[1:3], ', ')
      || ' (objection: ' || _r.label || E')\n  Say: '
      || _r.voice_ai_snippet || E'\n';
  END LOOP;
  _block := _block || E'\n';

  -- Live submission context if a submission_id is provided
  IF _submission_id IS NOT NULL THEN
    SELECT s.id, s.name, s.vehicle_year, s.vehicle_make, s.vehicle_model,
           s.offered_price, s.acv_value, s.acv_status,
           s.declined_reason, s.competitor_mentioned,
           s.customer_walk_away_number, s.loan_status,
           s.last_outreach_at
      INTO _sub
    FROM submissions s
    WHERE s.id = _submission_id;
    IF _sub.id IS NOT NULL THEN
      _block := _block || E'═══ THIS CUSTOMER ═══\n';
      _block := _block || 'Name: ' || COALESCE(_sub.name, 'Unknown') || E'\n';
      _block := _block || 'Vehicle: ' || COALESCE(_sub.vehicle_year, '') || ' '
                       || COALESCE(_sub.vehicle_make, '') || ' '
                       || COALESCE(_sub.vehicle_model, '') || E'\n';
      IF _sub.offered_price IS NOT NULL THEN
        _block := _block || 'Current offer: $' || _sub.offered_price::text || E'\n';
      END IF;
      IF _sub.acv_value IS NOT NULL THEN
        _block := _block || 'ACV ceiling: $' || _sub.acv_value::text
          || ' (' || COALESCE(_sub.acv_status, 'preliminary') || E')\n';
      END IF;
      IF _sub.declined_reason IS NOT NULL THEN
        _block := _block || 'Prior decline reason: ' || _sub.declined_reason || E'\n';
      END IF;
      IF _sub.competitor_mentioned IS NOT NULL THEN
        _block := _block || 'Competitor mentioned: ' || _sub.competitor_mentioned || E'\n';
      END IF;
      IF _sub.customer_walk_away_number IS NOT NULL THEN
        _block := _block || 'Customer''s stated walk-away: $' || _sub.customer_walk_away_number::text || E'\n';
      END IF;
      IF _sub.loan_status IS NOT NULL THEN
        _block := _block || 'Loan status: ' || _sub.loan_status || E'\n';
      END IF;
    END IF;
  END IF;

  RETURN _block;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compile_voice_agent_prompt(text, uuid, text) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
