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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'offer-ready': offerReady,
  'offer-accepted': offerAccepted,
  'offer-increased': offerIncreased,
  'appointment-confirmation': appointmentConfirmation,
  'appointment-reminder': appointmentReminder,
  'appointment-rescheduled': appointmentRescheduled,
  'referral-invite': referralInvite,
  'demo-request': demoRequest,
}
