/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Our Dealership'

interface Props {
  customerName?: string
  vehicle?: string
  offerAmount?: string
  portalLink?: string
  photosLink?: string
  docsLink?: string
  hasPhotos?: boolean
  hasDocs?: boolean
  dealershipName?: string
}

const OfferAcceptedEmail = ({
  customerName, vehicle, offerAmount, portalLink,
  photosLink, docsLink, hasPhotos, hasDocs, dealershipName,
}: Props) => {
  const needsPhotos = hasPhotos !== true
  const needsDocs = hasDocs !== true
  const needsUploads = needsPhotos || needsDocs

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Offer accepted — next steps for your {vehicle || 'vehicle'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>{(dealershipName || SITE_NAME).toUpperCase()}</Text>
          </Section>
          <Section style={content}>
            <Heading style={h1}>Offer Accepted! 🎉</Heading>
            <Text style={text}>Hi {customerName || 'there'},</Text>
            <Text style={text}>
              Thank you for accepting our offer on your <strong>{vehicle || 'vehicle'}</strong>!
            </Text>
            {offerAmount && (
              <Section style={offerBox}>
                <Text style={offerLabel}>Your Accepted Offer</Text>
                <Text style={offerValue}>{offerAmount}</Text>
              </Section>
            )}

            {/* Upload reminders when photos or docs are missing */}
            {needsUploads && (
              <Section style={uploadReminderBox}>
                <Text style={uploadReminderHeading}>⏱️ Save Time at Your Inspection</Text>
                <Text style={uploadReminderText}>
                  Upload these items now so we can get you in and out faster on inspection day:
                </Text>
                {needsPhotos && (
                  <Section style={uploadItem}>
                    <Text style={uploadItemText}>
                      📸 <strong>Vehicle Photos</strong> — Front, rear, sides, dashboard, and interior
                    </Text>
                    {photosLink && (
                      <Button style={uploadButton} href={photosLink}>
                        Upload Photos
                      </Button>
                    )}
                  </Section>
                )}
                {needsDocs && (
                  <Section style={uploadItem}>
                    <Text style={uploadItemText}>
                      📄 <strong>Documents</strong> — Driver's license, registration, and/or title
                    </Text>
                    {docsLink && (
                      <Button style={uploadButton} href={docsLink}>
                        Upload Documents
                      </Button>
                    )}
                  </Section>
                )}
                <Text style={uploadReminderFootnote}>
                  Uploading ahead of time means less paperwork and a faster checkout.
                </Text>
              </Section>
            )}

            <Text style={text}>
              <strong>Next Steps:</strong>
            </Text>
            <Text style={text}>
              1. Schedule your inspection visit{'\n'}
              {needsUploads
                ? '2. Upload your photos & documents (see above)\n3. Bring your keys — we\'ll handle the rest!'
                : '2. Bring your title, registration, and valid ID\n3. We\'ll handle the rest!'}
            </Text>
            {portalLink && (
              <Section style={ctaSection}>
                <Button style={button} href={portalLink}>
                  Schedule My Visit
                </Button>
              </Section>
            )}
            <Hr style={hr} />
            <Text style={footer}>Best regards,{'\n'}{dealershipName || SITE_NAME}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OfferAcceptedEmail,
  subject: (data: Record<string, any>) => `Offer Accepted — Next Steps for Your ${data.vehicle || 'Vehicle'}`,
  displayName: 'Customer offer accepted',
  previewData: {
    customerName: 'Jane Smith',
    vehicle: '2022 Honda Accord',
    offerAmount: '$18,500',
    portalLink: 'https://example.com/offer/abc123',
    photosLink: 'https://example.com/upload-photos/abc123',
    docsLink: 'https://example.com/upload-docs/abc123',
    hasPhotos: false,
    hasDocs: false,
    dealershipName: 'Example Motors',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: 'hsl(210, 100%, 25%)', padding: '24px 25px', borderRadius: '12px 12px 0 0' }
const logoText = { color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '2px', margin: '0', textAlign: 'center' as const }
const content = { padding: '32px 25px', border: '1px solid hsl(220, 13%, 91%)', borderTop: 'none', borderRadius: '0 0 12px 12px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(210, 29%, 24%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(220, 9%, 46%)', lineHeight: '1.6', margin: '0 0 20px', whiteSpace: 'pre-line' as const }

const uploadReminderBox = { backgroundColor: '#e8f4fd', borderRadius: '12px', padding: '20px', margin: '0 0 24px', border: '1px solid #b3d9f2' }
const uploadReminderHeading = { fontSize: '15px', fontWeight: 'bold' as const, color: 'hsl(210, 29%, 24%)', margin: '0 0 8px' }
const uploadReminderText = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', margin: '0 0 16px', lineHeight: '1.5' }
const uploadItem = { margin: '0 0 14px', padding: '12px 14px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid hsl(220, 13%, 91%)' }
const uploadItemText = { fontSize: '13px', color: 'hsl(210, 29%, 24%)', margin: '0 0 10px', lineHeight: '1.5' }
const uploadButton = { backgroundColor: 'hsl(210, 100%, 35%)', color: '#ffffff', fontSize: '12px', fontWeight: '600' as const, borderRadius: '8px', padding: '10px 20px', textDecoration: 'none' }
const uploadReminderFootnote = { fontSize: '12px', color: 'hsl(220, 9%, 46%)', margin: '4px 0 0', fontStyle: 'italic' as const }

const ctaSection = { textAlign: 'center' as const, margin: '0 0 20px' }
const button = { backgroundColor: 'hsl(210, 100%, 25%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const offerBox = { backgroundColor: 'hsl(210, 33%, 96%)', borderRadius: '12px', padding: '20px', textAlign: 'center' as const, margin: '0 0 20px' }
const offerLabel = { fontSize: '12px', color: 'hsl(220, 9%, 46%)', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '1px' }
const offerValue = { fontSize: '28px', fontWeight: 'bold' as const, color: 'hsl(210, 100%, 25%)', margin: '0' }
const hr = { borderColor: 'hsl(220, 13%, 91%)', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0', whiteSpace: 'pre-line' as const }
