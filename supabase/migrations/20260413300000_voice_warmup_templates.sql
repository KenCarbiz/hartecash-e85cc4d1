-- Add voice AI follow-up notification templates to notification_triggers if they don't exist
-- These are used by the voice-call-webhook for post-call SMS and by run-voice-campaign for pre-call warm-up

-- This migration just documents the trigger keys. The actual templates are loaded
-- from notificationDefaults.ts at runtime. No table inserts needed here.
-- Trigger keys added:
-- voice_warmup_sms: "Hey [Name], this is [Dealer]. We have a cash offer ready for your [Vehicle]. We'll give you a quick call shortly!"
-- customer_voicemail_followup: "Hey [Name], we just tried to reach you about your [Vehicle]. Your offer: [link]"
-- customer_missed_call_text: "Hey [Name], this is [Dealer]. We have a $[Amount] offer for your [Vehicle]. Tap here: [link]"
-- customer_callback_confirmation: "Thanks for chatting! We'll call you back as requested. Your offer: [link]"
SELECT 1;
