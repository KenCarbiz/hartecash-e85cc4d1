/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as offerReady } from './offer-ready.tsx'
import { template as offerAccepted } from './offer-accepted.tsx'
import { template as offerIncreased } from './offer-increased.tsx'
import { template as appointmentConfirmation } from './appointment-confirmation.tsx'
import { template as appointmentReminder } from './appointment-reminder.tsx'
import { template as appointmentRescheduled } from './appointment-rescheduled.tsx'
import { template as referralInvite } from './referral-invite.tsx'
import { template as demoRequest } from './demo-request.tsx'
import { template as staffAppraisalPending } from './staff-appraisal-pending.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'offer-ready': offerReady,
  'offer-accepted': offerAccepted,
  'offer-increased': offerIncreased,
  'appointment-confirmation': appointmentConfirmation,
  'appointment-reminder': appointmentReminder,
  'appointment-rescheduled': appointmentRescheduled,
  'referral-invite': referralInvite,
  'demo-request': demoRequest,
  'staff-appraisal-pending': staffAppraisalPending,
}

// ── Mascot URLs per trigger context ─────────────────────────────
// Maps a notification trigger_key to the mascot image rendered in
// the email header. Phase-1 placeholders point at planned filenames
// in the public `mascots/` Supabase storage bucket; once the real
// PNGs are uploaded these URLs become live without any code change
// to the templates themselves.
//
// To add a new mascot:
//   1. Upload <name>.png to the public mascots/ bucket.
//   2. Add an entry below mapping the trigger_key.
//   3. Templates pick it up via send-notification's enrichment step.

const MASCOT_BUCKET_BASE =
  'https://ptiwdwfdckfqivoocyvp.supabase.co/storage/v1/object/public/mascots'

export const MASCOTS_BY_TRIGGER: Record<string, { url: string; alt: string }> = {
  // Phase-1 trigger
  staff_appraisal_pending: {
    url: `${MASCOT_BUCKET_BASE}/mascot-math.png`,
    alt: 'Hartecash mascot crunching the numbers',
  },
  // Reserved for Phase-2 triggers
  staff_appraisal_pending_accepted: {
    url: `${MASCOT_BUCKET_BASE}/mascot-math.png`,
    alt: 'Hartecash mascot crunching the numbers',
  },
  staff_appraisal_pending_flagged: {
    url: `${MASCOT_BUCKET_BASE}/mascot-math.png`,
    alt: 'Hartecash mascot crunching the numbers',
  },
  staff_unaccepted_offer_review: {
    url: `${MASCOT_BUCKET_BASE}/mascot-thinking.png`,
    alt: 'Hartecash mascot thinking',
  },
  // Adjacent existing trigger keys — mascots will surface for these
  // once the assets are uploaded. Until then send-notification falls
  // back to the per-template DEFAULT_MASCOT_URL constant.
  staff_customer_arrived: {
    url: `${MASCOT_BUCKET_BASE}/mascot-looking-at-car.png`,
    alt: 'Hartecash mascot looking at a car',
  },
}
