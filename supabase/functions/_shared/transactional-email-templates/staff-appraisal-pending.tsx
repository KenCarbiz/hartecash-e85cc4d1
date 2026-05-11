/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

// Default fallback when a dealer hasn't set their own dealership_name.
const SITE_NAME = 'Hartecash'

// Mascot art for the appraisal-pending context. Phase-1 placeholder
// URL — Ken is shipping the real assets shortly. Once they're
// uploaded to the `mascots/` bucket, swap this constant (or move
// it to a per-trigger map in registry.ts).
const DEFAULT_MASCOT_URL =
  'https://ptiwdwfdckfqivoocyvp.supabase.co/storage/v1/object/public/mascots/mascot-math.png'

interface StaffAppraisalPendingProps {
  // Recipient context
  appraiserFirstName?: string
  // Submission context
  customerName?: string
  vehicle?: string
  acceptedPrice?: string         // formatted "$12,400" or null when not customer-accepted
  triggerKindLabel?: string      // "Customer accepted offer" | "Manager flagged for appraisal" | "Walk-in arrival"
  // Deep link
  appraisalLink?: string         // /appraisal/<token>
  // Branding
  dealershipName?: string
  brandPrimary?: string          // hsl/hex; falls back to default
  // Mascot — passed by send-notification, defaulted here
  mascotUrl?: string
  mascotAlt?: string
}

const StaffAppraisalPendingEmail = ({
  appraiserFirstName,
  customerName,
  vehicle,
  acceptedPrice,
  triggerKindLabel,
  appraisalLink,
  dealershipName,
  brandPrimary,
  mascotUrl,
  mascotAlt,
}: StaffAppraisalPendingProps) => {
  const headerBg = brandPrimary || 'hsl(210, 100%, 25%)'
  const buttonBg = brandPrimary || 'hsl(210, 100%, 25%)'
  const mascot = mascotUrl || DEFAULT_MASCOT_URL
  const mascotDescription = mascotAlt || 'Hartecash mascot crunching the numbers'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        New appraisal pending — {customerName || 'a customer'}'s {vehicle || 'vehicle'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...header, backgroundColor: headerBg }}>
            {/* Mascot — top-centered above the dealership wordmark.
                Width capped to 160px so Outlook/Gmail render it sanely
                on every viewport. */}
            <Img
              src={mascot}
              alt={mascotDescription}
              width="160"
              height="160"
              style={mascotImg}
            />
            <Text style={logoText}>{(dealershipName || SITE_NAME).toUpperCase()}</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>New Appraisal Pending</Heading>

            <Text style={text}>
              Hi {appraiserFirstName || 'there'},
            </Text>

            <Text style={text}>
              {customerName ? `${customerName}'s ` : 'A customer’s '}
              <strong>{vehicle || 'vehicle'}</strong>
              {' '}just landed in your appraiser queue
              {triggerKindLabel ? ` — ${triggerKindLabel.toLowerCase()}` : ''}.
              {acceptedPrice
                ? ` They accepted the ${acceptedPrice} offer pending your final ACV sign-off.`
                : ''}
            </Text>

            {appraisalLink && (
              <Section style={{ textAlign: 'center', margin: '24px 0' }}>
                <Button style={{ ...button, backgroundColor: buttonBg }} href={appraisalLink}>
                  Open Appraisal
                </Button>
              </Section>
            )}

            <Text style={hint}>
              If you're not signed in, you'll be prompted first — the appraisal
              page will be waiting after you log in.
            </Text>

            <Hr style={hr} />
            <Text style={footer}>
              {dealershipName || SITE_NAME}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: StaffAppraisalPendingEmail,
  subject: (data: Record<string, any>) =>
    `New Appraisal — ${data.vehicle || 'Vehicle'}${data.customerName ? ` (${data.customerName})` : ''}`,
  displayName: 'Staff: appraisal pending',
  previewData: {
    appraiserFirstName: 'Ken',
    customerName: 'John Smith',
    vehicle: '2019 Honda Civic',
    acceptedPrice: '$12,400',
    triggerKindLabel: 'Customer accepted offer',
    appraisalLink: 'https://hartecash.com/appraisal/abc123',
    dealershipName: 'Harte Auto Group',
    brandPrimary: 'hsl(213, 80%, 20%)',
    mascotUrl: DEFAULT_MASCOT_URL,
    mascotAlt: 'Hartecash mascot doing math',
  },
} satisfies TemplateEntry

// ── Styles ──────────────────────────────────────────────────────
// Inlined here per the rest of the registry's pattern (offer-ready.tsx,
// appointment-confirmation.tsx, etc.). Email-client-safe units only.

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}
const container = { maxWidth: '560px', margin: '0 auto' }
const header = {
  padding: '24px 25px 16px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const mascotImg = {
  display: 'block',
  margin: '0 auto 12px',
  borderRadius: '12px',
  // Light translucent backdrop so transparent PNGs read on any
  // header colour (and JPEG mascots get a subtle frame).
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
}
const logoText = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  letterSpacing: '2px',
  margin: '0',
  textAlign: 'center' as const,
}
const content = {
  padding: '32px 25px',
  border: '1px solid hsl(220, 13%, 91%)',
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(210, 29%, 24%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(220, 9%, 46%)',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const button = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const hint = {
  fontSize: '12px',
  color: '#999999',
  fontStyle: 'italic' as const,
  margin: '8px 0 0',
}
const hr = { borderColor: 'hsl(220, 13%, 91%)', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
