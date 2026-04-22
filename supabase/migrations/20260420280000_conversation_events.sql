-- Unified customer conversation thread.
--
-- Today every customer-dealer touchpoint lives in a different table —
-- activity_log for status changes and manual notes, voice_call_log
-- for AI + staff voice calls, notification_log for outbound SMS/email
-- sends, submissions for the original form, etc. The customer file
-- reconstructs a partial view of this by stitching two of those
-- surfaces together in the UI, which misses touches and doesn't let
-- a salesperson read the full history at a glance.
--
-- This migration creates a canonical conversation_events table + a
-- view that aggregates the existing legacy sources, plus backfill
-- for historical data. Going forward new writers insert directly;
-- existing writers (send-notification, voice-call-webhook,
-- activity-log inserts) will be updated in F2b to dual-write. The
-- view keeps working as a compatibility layer so code that reads the
-- thread sees a unified timeline regardless of where an event
-- originated.

CREATE TABLE IF NOT EXISTS public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id text NOT NULL DEFAULT 'default',
  -- What kind of communication?
  channel text NOT NULL
    CHECK (channel IN ('sms', 'email', 'voice', 'note', 'system', 'portal', 'status_change')),
  -- Customer → dealer, dealer → customer, or internal-to-dealer?
  direction text NOT NULL DEFAULT 'internal'
    CHECK (direction IN ('inbound', 'outbound', 'internal')),
  -- Who or what produced this event?
  actor_type text NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('customer', 'staff', 'system', 'ai')),
  actor_id uuid,                      -- nullable; populated for staff (auth.user_id)
  actor_label text,                   -- display name ("Jane BDC", "Customer", "AI Agent")
  body_text text,                     -- plain text body (always present)
  body_html text,                     -- optional rendered HTML (email)
  -- When did it happen from the customer's perspective? Not the
  -- row's created_at — for imported historical events these differ.
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- Channel-specific extras: recording_url for calls, transcript,
  -- email_message_id, sms_provider_id, etc. Kept as jsonb so the UI
  -- can render per-channel details without a schema change.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Back-reference to the legacy row for audit — so we can trace a
  -- conversation event back to its source voice_call_log /
  -- activity_log / notification_log entry.
  source_table text,
  source_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversation_events IS
  'Canonical per-submission timeline. Every customer↔dealer touchpoint lands here regardless of channel. ConversationThread UI reads from this; old code reads the v_conversation_thread view which overlays backfilled history.';

CREATE INDEX IF NOT EXISTS conversation_events_submission_occurred_idx
  ON public.conversation_events (submission_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS conversation_events_dealership_idx
  ON public.conversation_events (dealership_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS conversation_events_source_idx
  ON public.conversation_events (source_table, source_id)
  WHERE source_table IS NOT NULL;

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

-- Authenticated staff see events for their dealership. Anon customers
-- can read via the public portal RPC (not direct SELECT).
CREATE POLICY "Staff read own-dealership conversation events"
  ON public.conversation_events FOR SELECT TO authenticated
  USING (dealership_id = public.get_user_dealership_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff insert own-dealership conversation events"
  ON public.conversation_events FOR INSERT TO authenticated
  WITH CHECK (dealership_id = public.get_user_dealership_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full conversation events"
  ON public.conversation_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Backfill from existing sources ─────────────────────────────────
-- Idempotent via source_table + source_id unique-ish guard.

-- 1. voice_call_log → voice channel
INSERT INTO public.conversation_events
  (submission_id, dealership_id, channel, direction, actor_type, actor_label,
   body_text, occurred_at, metadata, source_table, source_id)
SELECT
  v.submission_id,
  COALESCE(s.dealership_id, 'default'),
  'voice',
  'outbound',
  'ai',
  'AI Agent',
  COALESCE(v.summary, v.transcript, v.outcome, 'Voice call completed'),
  v.created_at,
  jsonb_build_object(
    'outcome', v.outcome,
    'status', v.status,
    'duration_seconds', v.duration_seconds,
    'recording_url', v.recording_url,
    'transcript', v.transcript
  ),
  'voice_call_log',
  v.id::text
FROM public.voice_call_log v
LEFT JOIN public.submissions s ON s.id = v.submission_id
WHERE v.submission_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.conversation_events ce
    WHERE ce.source_table = 'voice_call_log' AND ce.source_id = v.id::text
  );

-- 2. activity_log → system / status_change / note channel
-- Heuristic: actions containing "status" or "progress" map to
-- status_change; otherwise note.
INSERT INTO public.conversation_events
  (submission_id, dealership_id, channel, direction, actor_type, actor_label,
   body_text, occurred_at, metadata, source_table, source_id)
SELECT
  a.submission_id,
  COALESCE(s.dealership_id, 'default'),
  CASE
    WHEN a.action ILIKE '%status%' OR a.action ILIKE '%progress%' THEN 'status_change'
    WHEN a.action ILIKE '%note%' OR a.action ILIKE '%internal%' THEN 'note'
    ELSE 'system'
  END,
  'internal',
  'staff',
  COALESCE(a.performed_by, 'System'),
  COALESCE(
    NULLIF(TRIM(CONCAT(a.action, ': ', COALESCE(a.new_value, ''))), ':'),
    a.action,
    'Activity'
  ),
  a.created_at,
  jsonb_build_object('action', a.action, 'old_value', a.old_value, 'new_value', a.new_value),
  'activity_log',
  a.id::text
FROM public.activity_log a
LEFT JOIN public.submissions s ON s.id = a.submission_id
WHERE a.submission_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.conversation_events ce
    WHERE ce.source_table = 'activity_log' AND ce.source_id = a.id::text
  );

-- 3. notification_log → sms / email channel, outbound
INSERT INTO public.conversation_events
  (submission_id, dealership_id, channel, direction, actor_type, actor_label,
   body_text, occurred_at, metadata, source_table, source_id)
SELECT
  n.submission_id,
  COALESCE(s.dealership_id, n.dealership_id, 'default'),
  CASE WHEN n.channel = 'email' THEN 'email' ELSE 'sms' END,
  'outbound',
  'system',
  'Autocurb',
  CONCAT(n.trigger_key, ' → ', n.recipient),
  n.created_at,
  jsonb_build_object('trigger_key', n.trigger_key, 'status', n.status, 'recipient', n.recipient),
  'notification_log',
  n.id::text
FROM public.notification_log n
LEFT JOIN public.submissions s ON s.id = n.submission_id
WHERE n.submission_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.conversation_events ce
    WHERE ce.source_table = 'notification_log' AND ce.source_id = n.id::text
  );

-- ── Triggers so new activity_log / notification_log / voice_call_log
-- rows automatically appear in the conversation thread ─────────────

CREATE OR REPLACE FUNCTION public.mirror_activity_to_conversation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.submission_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.conversation_events
    (submission_id, dealership_id, channel, direction, actor_type, actor_label,
     body_text, occurred_at, metadata, source_table, source_id)
  SELECT
    NEW.submission_id,
    COALESCE(s.dealership_id, 'default'),
    CASE
      WHEN NEW.action ILIKE '%status%' OR NEW.action ILIKE '%progress%' THEN 'status_change'
      WHEN NEW.action ILIKE '%note%' OR NEW.action ILIKE '%internal%' THEN 'note'
      ELSE 'system'
    END,
    'internal',
    'staff',
    COALESCE(NEW.performed_by, 'System'),
    COALESCE(
      NULLIF(TRIM(CONCAT(NEW.action, ': ', COALESCE(NEW.new_value, ''))), ':'),
      NEW.action,
      'Activity'
    ),
    NEW.created_at,
    jsonb_build_object('action', NEW.action, 'old_value', NEW.old_value, 'new_value', NEW.new_value),
    'activity_log',
    NEW.id::text
  FROM public.submissions s
  WHERE s.id = NEW.submission_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS activity_log_mirror_conversation ON public.activity_log;
CREATE TRIGGER activity_log_mirror_conversation
AFTER INSERT ON public.activity_log
FOR EACH ROW EXECUTE FUNCTION public.mirror_activity_to_conversation();

CREATE OR REPLACE FUNCTION public.mirror_notification_to_conversation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.submission_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.conversation_events
    (submission_id, dealership_id, channel, direction, actor_type, actor_label,
     body_text, occurred_at, metadata, source_table, source_id)
  SELECT
    NEW.submission_id,
    COALESCE(s.dealership_id, NEW.dealership_id, 'default'),
    CASE WHEN NEW.channel = 'email' THEN 'email' ELSE 'sms' END,
    'outbound',
    'system',
    'Autocurb',
    CONCAT(NEW.trigger_key, ' → ', NEW.recipient),
    NEW.created_at,
    jsonb_build_object('trigger_key', NEW.trigger_key, 'status', NEW.status, 'recipient', NEW.recipient),
    'notification_log',
    NEW.id::text
  FROM public.submissions s
  WHERE s.id = NEW.submission_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS notification_log_mirror_conversation ON public.notification_log;
CREATE TRIGGER notification_log_mirror_conversation
AFTER INSERT ON public.notification_log
FOR EACH ROW EXECUTE FUNCTION public.mirror_notification_to_conversation();

CREATE OR REPLACE FUNCTION public.mirror_voice_call_to_conversation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.submission_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.conversation_events
    (submission_id, dealership_id, channel, direction, actor_type, actor_label,
     body_text, occurred_at, metadata, source_table, source_id)
  SELECT
    NEW.submission_id,
    COALESCE(s.dealership_id, 'default'),
    'voice',
    'outbound',
    'ai',
    'AI Agent',
    COALESCE(NEW.summary, NEW.transcript, NEW.outcome, 'Voice call'),
    NEW.created_at,
    jsonb_build_object(
      'outcome', NEW.outcome,
      'status', NEW.status,
      'duration_seconds', NEW.duration_seconds,
      'recording_url', NEW.recording_url,
      'transcript', NEW.transcript
    ),
    'voice_call_log',
    NEW.id::text
  FROM public.submissions s
  WHERE s.id = NEW.submission_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS voice_call_log_mirror_conversation ON public.voice_call_log;
CREATE TRIGGER voice_call_log_mirror_conversation
AFTER INSERT ON public.voice_call_log
FOR EACH ROW EXECUTE FUNCTION public.mirror_voice_call_to_conversation();

NOTIFY pgrst, 'reload schema';
