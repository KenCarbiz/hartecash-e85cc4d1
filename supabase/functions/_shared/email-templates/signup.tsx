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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>HARTE AUTO GROUP</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Confirm your email</Heading>
          <Text style={text}>
            Thanks for signing up for{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            !
          </Text>
          <Text style={text}>
            Please confirm your email address (
            <Link href={`mailto:${recipient}`} style={link}>
              {recipient}
            </Link>
            ) by clicking the button below:
          </Text>
          <Button style={button} href={confirmationUrl}>
            Verify Email
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: 'hsl(210, 100%, 25%)', padding: '24px 25px', borderRadius: '12px 12px 0 0' }
const logoText = { color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '2px', margin: '0', textAlign: 'center' as const }
const content = { padding: '32px 25px', border: '1px solid hsl(220, 13%, 91%)', borderTop: 'none', borderRadius: '0 0 12px 12px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(210, 29%, 24%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(220, 9%, 46%)', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: 'hsl(210, 100%, 25%)', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(210, 100%, 25%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const hr = { borderColor: 'hsl(220, 13%, 91%)', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
