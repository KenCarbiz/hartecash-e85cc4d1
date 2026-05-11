// Dealer-facing mascot (Ken) — pose registry + hosted URL map.
//
// Used by:
//   _shared/email-templates/DealerMascotHeader.tsx  (the 6 auth emails)
//   send-notification/index.ts                      (the 6 staff alerts)
//
// PNG (not WebP) is mandatory because Outlook on Windows still doesn't
// render WebP. Files live in the public Supabase Storage bucket
// `email-assets`. The illustrator owes one PNG per pose at 480x240
// (display ~240x120 inside a 560px-wide email, 2x for retina).
//
// Until the assets ship, MASCOT_URLS points at the planned hosted paths.
// Email clients that can't load the image will fall back to the empty
// alt text gracefully (header still renders, just without Ken).

const BUCKET_BASE =
  'https://ptiwdwfdckfqivoocyvp.supabase.co/storage/v1/object/public/email-assets';

export type DealerMascotPose =
  | 'hero'        // confident / celebrating — deal wins, completed alerts
  | 'pointing'    // "look at this" — reply alerts, status notices
  | 'advisor'     // sympathetic / steady — security + account emails
  | 'welcoming'   // warm wave — invite, signup, email-change confirmations
  | 'alert';      // phone-in-hand / urgent — bdc-call, warm-transfer, hot-lead

export const MASCOT_URLS: Record<DealerMascotPose, string> = {
  hero:       `${BUCKET_BASE}/ken-hero.png`,
  pointing:   `${BUCKET_BASE}/ken-pointing.png`,
  advisor:    `${BUCKET_BASE}/ken-advisor.png`,
  welcoming:  `${BUCKET_BASE}/ken-welcoming.png`,
  alert:      `${BUCKET_BASE}/ken-alert.png`,
};

// Staff-alert trigger_keys → pose, used by send-notification/index.ts.
// Only staff_* and similar dealer-facing keys appear here; customer_*
// triggers must NEVER pick up a mascot.
export const STAFF_TRIGGER_POSE: Record<string, DealerMascotPose> = {
  staff_customer_accepted: 'hero',
  staff_deal_completed:    'hero',
  staff_customer_replied:  'pointing',
  staff_bdc_call_needed:   'alert',
  ai_warm_transfer_alert:  'alert',
  hot_lead:                'alert',
};

export const mascotUrlForTrigger = (triggerKey: string): string | null => {
  const pose = STAFF_TRIGGER_POSE[triggerKey];
  return pose ? MASCOT_URLS[pose] : null;
};
