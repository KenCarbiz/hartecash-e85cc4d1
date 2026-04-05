/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Our Dealership'

interface Props {
  customerName?: string
  vehicle?: string
  previousOffer?: string
  newOffer?: string
  portalLink?: string
  expirationDate?: string
  dealershipName?: string
}

const formatCurrency = (val?: string) => {
  if (!val) return '—'
  const n = Number(val.replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return val
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const OfferIncreasedEmail = ({ customerName, vehicle, previousOffer, newOffer, portalLink, expirationDate, dealershipName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Great news — we've increased the offer on your {vehicle || 'vehicle'}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>{(dealershipName || SITE_NAME).toUpperCase()}</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Your Offer Has Been Increased! 📈</Heading>
          <Text style={text}>Hi {customerName || 'there'},</Text>
          <Text style={text}>
            Great news! We've reviewed the market data for your <strong>{vehicle || 'vehicle'}</strong> and increased our offer.
          </Text>

          {/* Old vs New Comparison */}
          <Section style={comparisonContainer}>
            <Row>
              <Column style={comparisonCol}>
                <Text style={comparisonLabel}>Previous Offer</Text>
                <Text style={previousOfferAmount}>{formatCurrency(previousOffer)}</Text>
              </Column>
              <Column style={arrowCol}>
                <Text style={arrowText}>→</Text>
              </Column>
              <Column style={comparisonCol}>
                <Text style={comparisonLabel}>New Offer</Text>
                <Text style={newOfferAmount}>{formatCurrency(newOffer)}</Text>
              </Column>
            </Row>
          </Section>

          {portalLink && (
            <Section style={ctaSection}>
              <Button style={button} href={portalLink}>
                View Updated Offer
              </Button>
            </Section>
          )}

          {/* Expiration urgency */}
          {expirationDate && (
            <Section style={urgencyBox}>
              <Text style={urgencyText}>
                ⏰ This offer expires on <strong>{expirationDate}</strong> — act now to lock it in!
              </Text>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>Best regards,{'\n'}{dealershipName || SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OfferIncreasedEmail,
  subject: 'Great News — Your Offer Has Been Increased!',
  displayName: 'Customer offer increased',
  previewData: {
    customerName: 'Jane Smith',
    vehicle: '2022 Honda Accord',
    previousOffer: '18500',
    newOffer: '19750',
    portalLink: 'https://example.com/offer/abc123',
    expirationDate: 'April 12, 2026',
    dealershipName: 'Example Motors',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: 'hsl(210, 100%, 25%)', padding: '24px 25px', borderRadius: '12px 12px 0 0' }
const logoText = { color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '2px', margin: '0', textAlign: 'center' as const }
const content = { padding: '32px 25px', border: '1px solid hsl(220, 13%, 91%)', borderTop: 'none', borderRadius: '0 0 12px 12px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(210, 29%, 24%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(220, 9%, 46%)', lineHeight: '1.6', margin: '0 0 20px' }

const comparisonContainer = { backgroundColor: '#f8f9fa', borderRadius: '12px', padding: '20px 16px', margin: '0 0 24px', textAlign: 'center' as const }
const comparisonCol = { width: '42%', verticalAlign: 'top' as const }
const arrowCol = { width: '16%', verticalAlign: 'middle' as const }
const comparisonLabel = { fontSize: '11px', color: 'hsl(220, 9%, 46%)', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 6px', fontWeight: '600' as const }
const previousOfferAmount = { fontSize: '22px', fontWeight: 'bold' as const, color: '#999999', textDecoration: 'line-through' as const, margin: '0' }
const newOfferAmount = { fontSize: '26px', fontWeight: 'bold' as const, color: 'hsl(142, 71%, 35%)', margin: '0' }
const arrowText = { fontSize: '24px', color: 'hsl(210, 100%, 25%)', margin: '16px 0 0', fontWeight: 'bold' as const }

const ctaSection = { textAlign: 'center' as const, margin: '0 0 20px' }
const button = { backgroundColor: 'hsl(210, 100%, 25%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }

const urgencyBox = { backgroundColor: '#fff8e1', borderRadius: '8px', padding: '14px 16px', margin: '0 0 20px', border: '1px solid #ffe082' }
const urgencyText = { fontSize: '13px', color: 'hsl(210, 29%, 24%)', margin: '0', textAlign: 'center' as const }

const hr = { borderColor: 'hsl(220, 13%, 91%)', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0', whiteSpace: 'pre-line' as const }
