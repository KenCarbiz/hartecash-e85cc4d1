import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "AutoCurb"

interface DemoRequestProps {
  dealershipName?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  monthlyVolume?: string
  message?: string
}

const DemoRequestEmail = ({ dealershipName, contactName, contactEmail, contactPhone, monthlyVolume, message }: DemoRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New demo request from {dealershipName || 'a dealership'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🚗 New Demo Request</Heading>
        <Text style={text}>A dealership has requested a demo of {SITE_NAME}.</Text>
        <Hr style={hr} />
        <Text style={label}>Dealership</Text>
        <Text style={value}>{dealershipName || 'Not provided'}</Text>
        <Text style={label}>Contact Name</Text>
        <Text style={value}>{contactName || 'Not provided'}</Text>
        <Text style={label}>Email</Text>
        <Text style={value}>{contactEmail || 'Not provided'}</Text>
        <Text style={label}>Phone</Text>
        <Text style={value}>{contactPhone || 'Not provided'}</Text>
        {monthlyVolume && (
          <>
            <Text style={label}>Monthly Used Volume</Text>
            <Text style={value}>{monthlyVolume}</Text>
          </>
        )}
        {message && (
          <>
            <Text style={label}>Message</Text>
            <Text style={value}>{message}</Text>
          </>
        )}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DemoRequestEmail,
  subject: (data: Record<string, any>) => `Demo Request: ${data.dealershipName || 'New Lead'}`,
  to: 'ken@ken.cc',
  displayName: 'Demo request notification',
  previewData: {
    dealershipName: 'Acme Motors',
    contactName: 'John Smith',
    contactEmail: 'john@acmemotors.com',
    contactPhone: '(555) 123-4567',
    monthlyVolume: '100-200',
    message: 'Interested in the off-street channel.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '16px 0' }
const label = { fontSize: '11px', fontWeight: 'bold' as const, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px' }
const value = { fontSize: '15px', color: '#1a1a2e', margin: '0 0 14px' }
