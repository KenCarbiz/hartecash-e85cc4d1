-- Objection playbook
CREATE TABLE IF NOT EXISTS public.objection_playbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  objection_key text NOT NULL,
  category text NOT NULL,
  label text NOT NULL,
  customer_signals text[] NOT NULL DEFAULT '{}',
  customer_concern text NOT NULL,
  dealer_reframe text NOT NULL,
  proof_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  escalation_path text,
  voice_ai_snippet text,
  fires_on jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, objection_key)
);

ALTER TABLE public.objection_playbook ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own tenant objections" ON public.objection_playbook;
CREATE POLICY "Admins manage own tenant objections"
  ON public.objection_playbook FOR ALL TO authenticated
  USING  (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Staff read own tenant objections" ON public.objection_playbook;
CREATE POLICY "Staff read own tenant objections"
  ON public.objection_playbook FOR SELECT TO authenticated
  USING (
    dealership_id = 'default'
    OR dealership_id = get_user_dealership_id(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Public read default objections" ON public.objection_playbook;
CREATE POLICY "Public read default objections"
  ON public.objection_playbook FOR SELECT TO public
  USING (dealership_id = 'default' AND is_active = true);

CREATE INDEX IF NOT EXISTS objection_playbook_dealer_idx
  ON public.objection_playbook (dealership_id, sort_order)
  WHERE is_active = true;

INSERT INTO public.objection_playbook
  (dealership_id, objection_key, category, label, customer_signals,
   customer_concern, dealer_reframe, proof_points, escalation_path,
   voice_ai_snippet, fires_on, sort_order)
VALUES
('default','carmax_higher','competitor','CarMax offered me more',
 ARRAY['carmax','car max','carvana','vroom','offered more','better offer','higher offer'],
 'They are afraid of leaving money on the table. The fear is louder than the dollar gap. CarMax/Carvana wholesale most of what they buy and use the customer'' s ego-anchor (the highest number they have seen) to lock the deal. Many of those numbers come down at inspection — but the customer doesn''t know that yet.',
 'I hear you — let''s look at it side by side. Their number is a wholesale buy price. They are flipping the car at auction next week, which is why they can publish a wide range up front and then chip at it during the inspection. We are buying the car for our own retail lot, so we are pricing it against what we will actually sell it for, not what an out-of-state wholesaler would pay. If you can show me their offer in writing — text, email, screenshot, anything — and we are within $300, I will match it on the spot. No re-appraisal, no inspection delta, no games.',
 '[{"label":"$300 best-price-match","description":"In writing on the offer page. Match without re-appraisal."},{"label":"Auction comp grid","description":"Last 5 same-trim sales with VINs + dates."},{"label":"Retail vs wholesale explainer","description":"One-page why their number is a wholesale ceiling, ours is a retail buy-floor."}]'::jsonb,
 'If gap is over $300: route to sales manager for a one-time exception within 30 minutes, do not make the customer wait overnight. Manager either approves the match or sends a personalized voice/email explaining the comp ceiling.',
 'Yeah, I get it. Quick thing though — their number''s a wholesale price. They flip the car at auction. We''re buying it for our lot, so we''re pricing against what we''ll actually sell it for. If you can text me their offer, and we''re within three hundred bucks, I''ll match it right now. No inspection games. Want to send me a screenshot?',
 '{"decline_reasons":["price_too_low","competitor_offer"],"competitors":["carmax","carvana","vroom"]}'::jsonb,
 10),
('default','offer_feels_low','price','The offer feels low',
 ARRAY['too low','not enough','low offer','feels low','expected more','worth more','blue book'],
 'The customer compared our offer to a Google search showing retail asking prices, not wholesale buy prices. They literally do not know there is a difference. KBB''s "instant cash offer" is the closest comparable, but everyone clicks "trade-in value" by accident.',
 'Totally fair, and I can show you exactly how I got to that number. The price you see on Google or KBB is the retail asking price — what dealers list it for after recon, warranty, detail, and lot time. The buy number for the dealership is always lower because we have to factor that in. Here are five cars exactly like yours that sold at auction in the last two weeks. That''s what we''re anchored to. If you''d rather upload six quick photos and let our AI re-score it for condition, that can move the number up. Up to you.',
 '[{"label":"Recent comp grid","description":"5 same-trim sales with VINs and dates from the last 14 days."},{"label":"Retail vs buy-price explainer","description":"What KBB / Edmunds prices are actually showing."},{"label":"Photo-based boost","description":"Upload 6 photos, re-score for condition."}]'::jsonb,
 'If still unhappy after seeing comps + boost: offer 24h to upload photos for re-evaluation. If declined again, accept it — pushing harder past three reframes burns trust.',
 'Yeah, that happens — most people compare it to a Google number, which is the retail asking price after dealers recondition the car. The buy number is always lower than that. I can show you what cars exactly like yours sold for at auction last week if you want to see the math. Or, if it''s a condition thing, you can upload six photos and we''ll re-score it. What sounds better?',
 '{"decline_reasons":["price_too_low"]}'::jsonb,
 20),
('default','info_safety','trust','I''m worried about my info getting passed around',
 ARRAY['my info','identity','privacy','data','safe','passed around','shared'],
 'The fear is rational — Carvana and CarMax wholesale flows do expose title data and contact info to downstream auction buyers. The customer has read horror stories or had identity theft happen. They want certainty, not assurance.',
 'That is a real concern, and it''s the right thing to ask. Here is how it works with us versus the big online buyers. We are buying the car for our own lot — we will retail it ourselves. Your title, your name, your contact info stay in this building. There is no auction, no third-party buyer, no data broker. The only people who ever see your name on this transaction are me, our title clerk, and the DMV. With Carvana or CarMax, that car is going to wholesale within a week — your title and registration touch every downstream auction buyer. We can put it in writing on dealership letterhead if it would help.',
 '[{"label":"Where your data goes diagram","description":"One-page visual: us (3 people) vs them (15+ touch points)."},{"label":"Privacy commitment letter","description":"On dealership letterhead, signed by the GM. Available on request."},{"label":"State DMV title-only flow","description":"Our title clerk takes the title to the DMV. No third party."}]'::jsonb,
 'If still hesitant: offer to email the privacy commitment letter. Costs nothing, often closes hard because it surfaces our seriousness about the concern.',
 'Yeah, that''s a fair worry, and honestly it''s the right thing to ask. Here''s the difference — we''re buying this car to sell on our own lot. Your title and your info stay right here. Three people see it: me, our title clerk, and the DMV. With Carvana or CarMax, the car gets wholesaled in a week and your info touches everyone downstream. Want me to email you a privacy letter from our GM?',
 '{"decline_reasons":["privacy_concern","trust"]}'::jsonb,
 30),
('default','private_sale_diy','trust','I''ll just sell it privately',
 ARRAY['craigslist','facebook marketplace','private sale','sell it myself','sell privately','autotrader'],
 'The customer is anchored on the higher headline price they think they can get private-party. They have not factored in: strangers showing up at their home for test drives, certified-check fraud, the time tax of running ads + screening, the liability of a buyer test-driving and crashing their car before signing, and the personal-safety risk for women selling alone. Most do not enjoy it once they actually try.',
 'You can definitely get a higher headline number going private — that part is real. But factor in what comes with it. You''ll have strangers showing up at your house for test drives. If they crash on the test drive before you sign, you''re still the registered owner. Cashier checks bounce and forged checks are common — most banks make you wait days to confirm clearance. The average car sells in 38 days private-party and you''ll do 60 to 90 minutes of work per buyer who doesn''t buy. We''re writing a check today, you don''t have anyone in your driveway, the title goes to the DMV not to a stranger, and you''re done in 30 minutes. What''s your time worth in that 38 days?',
 '[{"label":"Private-sale risk one-pager","description":"Test-drive liability, payment fraud patterns, average days-on-market, personal-safety stats."},{"label":"Time-value math","description":"Hours of work per private buyer × number of tire-kickers = real net hourly."},{"label":"Same-day check","description":"Money in 30 minutes versus 38-day average."}]'::jsonb,
 'If still considering private: ask "if it doesn''t sell in two weeks, can we revisit?" — many come back. Send a 7-day price lock so they have a fall-back without an ego cost.',
 'Yeah, you can probably get a higher headline number selling it yourself. But — strangers in your driveway, fake checks, and if someone test-drives and crashes it, you''re still on the title. Average car sells in thirty-eight days going private. We''re writing you a check today. Tell you what — let me lock this number for seven days so you''ve got a fallback, and if private-party doesn''t pan out, we''re here.',
 '{"decline_reasons":["selling_privately","craigslist"]}'::jsonb,
 35),
('default','wholesale_concern','trust','I don''t want my car wholesaled',
 ARRAY['wholesale','wholesaled','auction','auctioning'],
 'The customer either had a bad experience selling to a wholesaler before, or read about how CarMax/Carvana flip cars they bought. They have moral or practical objections to fueling that flow. This is one we LEAD with at the right kind of dealership.',
 'That is a real difference between us and the online buyers, and I appreciate you bringing it up. We are not flipping it. We''re buying this car for our retail lot — same place we sell every other car here. We will recondition it, photograph it, and someone will buy it from us as their next vehicle. Your title goes from your hands to the DMV through us — it does not touch an auction or a wholesale buyer. If you want to see our lot inventory before you decide, here is the link.',
 '[{"label":"Our retail inventory","description":"Show the dealer''s active inventory listing. Customer''s car will look like these in 2 weeks."},{"label":"Direct-buy commitment","description":"Written on dealership letterhead — this car is not for resale to a wholesaler."}]'::jsonb,
 'If still hesitant: walk them through the lot virtually (FaceTime / Zoom if needed). Showing the car-on-lot end-state usually closes it.',
 'Yeah, I get that. The difference here is — we''re not wholesaling it. We retail every car we buy. It''ll go on our lot, get reconditioned, and someone''s gonna buy it from us as their next car. Your title goes from you to the DMV through us — it never touches an auction. Want me to text you a link to our lot so you can see the kind of inventory we run?',
 '{"decline_reasons":["wholesale_concern","trust"]}'::jsonb,
 40),
('default','need_to_think','timing','I want to think about it',
 ARRAY['think about it','think it over','need to think','sleep on it'],
 'Decision fatigue is real, but "I want to think about it" usually means one of three things they did not say: spouse hasn''t weighed in, they got a different number elsewhere and are comparing, or they are about to ghost. We need to surface which one without pushing.',
 'Of course — take the time. Two things real quick. First, I am locking this number for 7 days so you''re not negotiating against yourself. Second — if it would help to have it in writing for someone else to look at, I can email you a one-page summary you can forward. Anything specific I can clear up before you go?',
 '[{"label":"7-day price lock","description":"Number is honored for 7 days subject to condition match."},{"label":"Shareable offer summary","description":"Email-ready PDF the customer can forward to spouse / advisor."},{"label":"Tentative slot hold","description":"Book a Saturday slot, cancel-free if needed."}]'::jsonb,
 'If they still hedge: book a tentative slot ("I''ll hold Saturday at 10:30 — cancel free if it doesn''t work"). Held slots are commitment devices. Worst case: a 7-day no-engagement re-engagement at T+72h surfaces the real objection.',
 'Yeah, take whatever time you need. Two things — I''ll lock this number for seven days so it''s not a moving target. And if it''d help to have a written summary for someone else to look at, I''ll email it over. Anything I can clear up real quick before you go?',
 '{"decline_reasons":["thinking","not_ready","need_to_think"]}'::jsonb,
 50),
('default','spouse_decider','logistics','My spouse / partner needs to see it',
 ARRAY['spouse','wife','husband','partner','my wife','my husband'],
 'Genuine co-decider, not a stall. Dealer''s job is to make the second viewer easy: shareable summary, calendar slot that works for both, and not pressuring the in-front-of-you customer to commit unilaterally.',
 'Totally — half the cars I help with are co-titled. I''ll send you a short email summary you can forward. If the two of you want, I''ll hold a tentative slot for this Saturday so we''re not playing calendar tag — cancel-free if the timing changes. What time works best for both of you?',
 '[{"label":"Co-decider summary email","description":"Brief PDF with offer + comps + what to bring."},{"label":"Saturday tentative hold","description":"Cancel-free held slot so the couple can plan."}]'::jsonb,
 'If they would rather both come in: book the soonest slot that works for both. Do not push for unilateral acceptance from the in-front-of-you partner.',
 'Yeah, totally — half the cars I help with are co-titled, makes complete sense. I''ll text you a short summary you can show your spouse. And let me hold a Saturday slot — cancel-free if it doesn''t work. What time''s good for both of you?',
 '{"decline_reasons":["spouse_decision","co_decider"]}'::jsonb,
 55),
('default','negative_equity','logistics','I owe more than it''s worth',
 ARRAY['negative equity','owe more','upside down','underwater','more than it''s worth'],
 'Negative equity is a math problem disguised as an objection. Most customers do not realize the dealer can roll the difference into a new financing arrangement, or that a payoff letter from the lender clarifies the actual gap (which is often smaller than they fear).',
 'You are not alone — about 1 in 4 trades has some negative equity. Here is what we do: I''ll have you fill out a payoff authorization, we contact your lender and get the exact 10-day payoff in writing. Then we know the real gap. From there it is a math problem — sometimes the gap is smaller than you think because of unearned interest, sometimes it makes sense to roll into a different arrangement. Either way the only person it costs to find out is me.',
 '[{"label":"Payoff authorization form","description":"Dealer contacts lender directly; customer never has to navigate it."},{"label":"Same-day 10-day payoff","description":"Most lenders respond within 24h."},{"label":"Roll-the-difference paths","description":"If trading into another vehicle, options exist."}]'::jsonb,
 'If unwilling to share lender info: explain that we can''t bridge what we can''t see. Reframe: "I am trying to help you — let''s at least know the real number."',
 'Hey, that''s pretty common — about a quarter of the cars I work on have some negative equity. Here''s the move — let''s have your lender send the exact ten-day payoff. Then we know the real gap. Sometimes it''s smaller than people think because of unearned interest. Want me to send you the authorization form? It only takes a minute.',
 '{"decline_reasons":["negative_equity","payoff"]}'::jsonb,
 60),
('default','title_not_in_hand','logistics','I don''t have the title',
 ARRAY['don''t have the title','don''t have title','title is at home','lender has title','no title'],
 'Either the lender holds it (active loan) or they misplaced it. Both are solvable; the customer assumes the deal is dead.',
 'No worries — that is more common than you''d think. If your lender holds the title, we coordinate directly with them and the title comes through us. If you misplaced it, your state DMV has a duplicate-title process — I can text you the exact link for your state, takes about 10 days for the paper to come in. Either way it is not a deal-killer.',
 '[{"label":"State-specific duplicate title link","description":"DMV form pre-filled with state context."},{"label":"Lender title-release flow","description":"We coordinate with the lender; customer signs an authorization."}]'::jsonb,
 'If lost and the customer is in a hurry: schedule the inspection now, plan to fund the day the title arrives. We hold the offer.',
 'No worries, that''s super common. If your lender''s holding it, we work with them directly. If you misplaced it, your state DMV does a duplicate — I can text you the exact link, takes about ten days. Not a deal-killer either way.',
 '{"decline_reasons":["no_title","lender_has_title"]}'::jsonb,
 65),
('default','need_replacement_first','timing','I haven''t found a replacement vehicle yet',
 ARRAY['replacement','need a car','still looking','haven''t found','what to drive'],
 'The customer assumes they need to swap same-day. Many dealers can hold the buy or arrange a short bridge — but few customers know that.',
 'You don''t have to swap them same-day. Two paths: I can lock this offer for 7 days so you''re not pressured. Or, if you''re in the market for something specific, we may have it on our lot — would save you the search and the gap. What are you looking at?',
 '[{"label":"7-day offer lock","description":"Number honored for 7 days, you take delivery when ready."},{"label":"Lot inventory cross-shop","description":"If we have something close to what they want, no gap."}]'::jsonb,
 'If they are firm on no-buy from us: just hold the offer 7 days. Do not push the lot — feels manipulative.',
 'Hey, you don''t have to swap same-day. I can lock this number for seven days while you find your next ride. Or — what are you shopping for? We might have something on the lot that''d save you the gap.',
 '{"decline_reasons":["need_replacement"]}'::jsonb,
 70),
('default','sold_elsewhere','competitor','I already sold it / accepted another offer',
 ARRAY['already sold','accepted','went with','took the','sold to'],
 'Acknowledge, do not fight. Trying to claw back a customer who already accepted elsewhere burns trust and reads desperate.',
 'Got it — appreciate you letting me know. If anything falls through with them, my offer is good for 7 days. And in the future, the next car you''re thinking about selling, I''d love to be your first call. Best of luck on the new one.',
 '[{"label":"7-day fallback","description":"Offer stays warm in case the other deal falls apart."},{"label":"Future-relationship door","description":"Plant the seed for the next vehicle without pressure."}]'::jsonb,
 'No escalation — accept the answer. Mark as `sold_elsewhere` in declined_reason for accurate reporting.',
 'Got it, appreciate you letting me know. If anything falls through, this offer''s good for seven days. And next time you''re selling, I''d love to be your first call. Take care.',
 '{"decline_reasons":["sold_elsewhere","accepted_other"]}'::jsonb,
 80),
('default','tax_time_waiting','timing','I''ll wait until tax time',
 ARRAY['tax time','tax return','tax refund','wait until','next month'],
 'They believe waiting will let them buy something better with refund money. Often correct — but used-car values move with the market, not their tax calendar. The longer they wait, the more depreciation eats their offer.',
 'Fair. Two things to think about. Used-car values usually soften through Q1 — every week you wait, your offer ticks down a little. And even if you hold the cash from us, you can still buy the next car with your refund — they''re not the same dollars. I can lock this offer for 7 days; if you want to revisit in a month I''ll re-quote then. Just want you to know what the trade-off is.',
 '[{"label":"Depreciation curve","description":"Same VIN, monthly auction price last 12 months."},{"label":"Cash-now flexibility","description":"Sell now, buy when ready — the dollars are not married."}]'::jsonb,
 'If still firm on waiting: 30-day reactivation cohort with a fresh re-quote then. Sometimes the market does move favorably — be honest if it does.',
 'Yeah, that''s fair. Just so you know — used car values usually soften through Q1, so every week you wait, the number ticks down a bit. And the cash from us isn''t locked to the next car — you can still use your refund. Want me to lock it for seven days so you have the option?',
 '{"decline_reasons":["wait_for_tax","not_ready_yet"]}'::jsonb,
 85),
('default','condition_dispute','price','You''re docking me too much for condition',
 ARRAY['too much for','condition','docking','knocking','dings','minor'],
 'Customer feels their car is in better shape than the appraiser scored. Sometimes right (appraiser was conservative), sometimes wrong (everyone thinks their car is "above average"). Either way, the dispute path needs to be visible and fast.',
 'Good — let''s look at it together. I''ll walk through line-by-line what I marked and why. If you think anything''s off, I want to know. I''d rather get the number right the first time than have you feel chopped. And — we have a photo-based AI re-score. Upload six fresh photos, the algorithm scores them independently of me, and if it comes back better than my call, the number moves up.',
 '[{"label":"Line-item walkthrough","description":"Tablet shows each scored item with the appraiser, customer can dispute."},{"label":"AI photo re-score","description":"Six photos, independent score, can move the number up."},{"label":"Manager review on >$500 deltas","description":"Manager personally reviews any reduction over $500."}]'::jsonb,
 'If still feels wronged: AI re-score is the close. The independent score is the proof point.',
 'Yeah, let''s look at it together — I''ll walk through what I marked and why. If something''s off, I want to know. We''ve also got an AI photo re-score — upload six pictures, it scores independent of me, and if it''s better than my call, the number moves up. Want to try that?',
 '{"decline_reasons":["condition_disputed","docked_too_much"]}'::jsonb,
 90),
('default','online_quote_higher','competitor','Your online quote was higher than this offer',
 ARRAY['online quote','website','your website','quote was','said it was worth','range'],
 'The website range is generated from VIN + reported condition. Our offer reflects what we''ve actually seen / inspected (or the customer self-reported a worse condition than they realized). Either way the gap needs an honest explanation.',
 'Good catch — let me reconcile that. Our online tool gives a range based on what you tell it about the car. The number I''m quoting reflects [specific input that changed]. If anything I noted is off, tell me — I''d rather adjust now than have a mismatch. And the boost flow is open if you want the AI to re-score it from photos.',
 '[{"label":"Input-by-input reconciliation","description":"Walk through what the customer entered online vs what we found."},{"label":"Boost re-score","description":"Photos override scored condition if better."}]'::jsonb,
 'If we genuinely lowballed at the lane: manager reviews. Honest mistakes get fixed honestly.',
 'Good catch. Let me reconcile that — the online tool gives a range based on what you told it. Our number reflects [specific thing that changed]. If anything I noted is off, tell me — I''d rather adjust now. Want to try the photo re-score?',
 '{"decline_reasons":["online_quote_mismatch"]}'::jsonb,
 95),
('default','urgency_today','logistics','I need cash today',
 ARRAY['need cash','cash today','need money','emergency','today only'],
 'Real urgency — but also a vulnerable state. Easy to over-promise. Be honest about what we can deliver same-day.',
 'I hear you. Same-day check is doable — bring the car, ID, title (or lender authorization), all keys. Most folks are in and out in 30 to 45 minutes. Earliest slot today is [time]. If you don''t have title in hand, that adds time — let me know your situation and I''ll be straight with you on what''s real.',
 '[{"label":"Same-day check window","description":"30–45 min from arrival to check-in-hand if title is clean."},{"label":"Honest gating","description":"What blocks a same-day funding (no title, payoff lag)."}]'::jsonb,
 'If they cannot make same-day work due to title or payoff: tell them now. Do not let them drive in expecting the impossible.',
 'Hey, I hear you. Same-day check works — bring the car, ID, title or your lender authorization, and all keys. Most people are in and out in thirty to forty-five minutes. What''s the earliest you can be here?',
 '{"decline_reasons":["urgency","need_cash_today"]}'::jsonb,
 100)
ON CONFLICT (dealership_id, objection_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_objection_playbook_for_voice(
  _dealership_id text DEFAULT 'default'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _block text := '';
  _row record;
BEGIN
  FOR _row IN
    SELECT label, customer_signals, voice_ai_snippet
    FROM objection_playbook
    WHERE (dealership_id = _dealership_id OR dealership_id = 'default')
      AND is_active = true
      AND voice_ai_snippet IS NOT NULL
    ORDER BY
      CASE WHEN dealership_id = _dealership_id THEN 0 ELSE 1 END,
      sort_order
  LOOP
    _block := _block
      || E'\n— If they say something like '
      || array_to_string(_row.customer_signals[1:3], ', ')
      || ' (objection: ' || _row.label || ')\n  Say: '
      || _row.voice_ai_snippet || E'\n';
  END LOOP;

  RETURN 'OBJECTION HANDLING PLAYBOOK — match the customer''s words to one of these and use the response. Stay conversational, do not read it like a script.' || _block;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_objection_playbook_for_voice(text) TO authenticated, anon, service_role;

-- Arrival link tracking + realtime
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS arrival_link_sent_at timestamptz;

ALTER TABLE public.submissions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';