/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Our Dealership'

interface Props {
  customerName?: string
  vehicle?: string
  appointmentDate?: string
  appointmentTime?: string
  location?: string
  dealershipName?: string
}

const AppointmentConfirmationEmail = ({ customerName, vehicle, appointmentDate, appointmentTime, location, dealershipName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your appointment on {appointmentDate || 'upcoming date'} is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>{(dealershipName || SITE_NAME).toUpperCase()}</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Appointment Confirmed! ✅</Heading>
          <Text style={text}>Hi {customerName || 'there'},</Text>
          <Text style={text}>Your inspection appointment has been confirmed.</Text>
          <Section style={detailsBox}>
            <Text style={detailRow}>📅 <strong>Date:</strong> {appointmentDate || 'TBD'}</Text>
            <Text style={detailRow}>🕐 <strong>Time:</strong> {appointmentTime || 'TBD'}</Text>
            {location && <Text style={detailRow}>📍 <strong>Location:</strong> {location}</Text>}
            {vehicle && <Text style={detailRow}>🚗 <strong>Vehicle:</strong> {vehicle}</Text>}
          </Section>
          <Text style={text}>
            <strong>Remember to bring:</strong>{'\n'}
            • Vehicle title{'\n'}
            • Valid photo ID{'\n'}
            • Registration{'\n'}
            • All keys & remotes
          </Text>
          <Hr style={hr} />
          <Text style={footer}>See you soon!{'\n'}{dealershipName || SITE_NAME}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AppointmentConfirmationEmail,
  subject: (data: Record<string, any>) => `Appointment Confirmed — ${data.appointmentDate || 'Upcoming Visit'}`,
  displayName: 'Customer appointment confirmation',
  previewData: {
    customerName: 'Jane Smith',
    vehicle: '2022 Honda Accord',
    appointmentDate: 'January 15, 2026',
    appointmentTime: '10:00 AM',
    location: 'Example Motors — Main St',
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
const detailsBox = { backgroundColor: 'hsl(210, 33%, 96%)', borderRadius: '12px', padding: '16px 20px', margin: '0 0 20px' }
const detailRow = { fontSize: '14px', color: 'hsl(210, 29%, 24%)', margin: '0 0 8px', lineHeight: '1.5' }
const hr = { borderColor: 'hsl(220, 13%, 91%)', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0', whiteSpace: 'pre-line' as const }
