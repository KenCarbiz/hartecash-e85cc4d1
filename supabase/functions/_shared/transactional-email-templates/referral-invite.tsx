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
  referralLink?: string
  rewardAmount?: string
  dealershipName?: string
  staffName?: string
  personalNote?: string
  isStaffInvite?: boolean
}

/* ── Staff-sent invite (personal recommendation) ── */
const StaffReferralEmail = ({ customerName, referralLink, rewardAmount, dealershipName, staffName, personalNote }: Props) => {
  const dn = dealershipName || SITE_NAME
  const reward = rewardAmount || '200'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{staffName || 'A friend'} thinks you should check this out — sell or trade your car the easy way!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>{dn.toUpperCase()}</Text>
          </Section>
          <Section style={content}>
            <Heading style={h1}>
              {staffName ? `${staffName} Recommends Us!` : "You've Been Referred!"} 🚗✨
            </Heading>
            <Text style={text}>Hi {customerName || 'there'},</Text>

            {personalNote ? (
              <Section style={noteBox}>
                <Text style={noteQuote}>"{personalNote}"</Text>
                <Text style={noteAttrib}>— {staffName || 'Your friend'}</Text>
              </Section>
            ) : (
              <Text style={text}>
                {staffName || 'Someone you know'} had a great experience with us and thought you'd love it too!
                Whether you're looking to <strong>sell your car</strong> or <strong>trade it in</strong> for something new,
                we make it fast, easy, and fair.
              </Text>
            )}

            <Text style={text}>
              Here's how it works: click the link below, tell us about your car, and get an instant offer.
              It takes less than 2 minutes — and <strong>you could earn up to ${reward}</strong> when both of you complete a deal!
            </Text>

            <Section style={benefitsBox}>
              <Text style={benefitsTitle}>Why People Love Us</Text>
              <Text style={benefitItem}>✅ Get an offer in minutes — no haggling</Text>
              <Text style={benefitItem}>✅ Free inspection, no obligation</Text>
              <Text style={benefitItem}>✅ Get paid on the spot or trade toward a new ride</Text>
              <Text style={benefitItem}>✅ Thousands of happy customers</Text>
            </Section>

            {referralLink && (
              <Section style={ctaSection}>
                <Button style={button} href={referralLink}>
                  Get My Instant Offer →
                </Button>
                <Text style={subCtaText}>Takes less than 2 minutes. No commitment.</Text>
              </Section>
            )}

            <Section style={rewardBox}>
              <Text style={rewardText}>
                🎁 <strong>Bonus:</strong> When you sell or trade your car with us, {staffName || 'your referrer'} earns
                a reward — and you'll get the VIP treatment!
              </Text>
            </Section>

            <Hr style={hr} />
            <Text style={footer}>
              {dn}{'\n'}
              Questions? Just reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ── Customer-to-customer referral email ── */
const CustomerReferralEmail = ({ customerName, vehicle, referralLink, rewardAmount, dealershipName }: Props) => {
  const dn = dealershipName || SITE_NAME
  const reward = rewardAmount || '200'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You sold us your car — now earn ${reward} for telling a friend! 🎉</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>{dn.toUpperCase()}</Text>
          </Section>
          <Section style={content}>
            <Text style={heroEmoji}>🎉💰🚗</Text>
            <Heading style={h1}>You Did Great — Now Get Paid Again!</Heading>
            <Text style={text}>Hi {customerName || 'there'},</Text>
            <Text style={text}>
              Thanks for selling us your <strong>{vehicle || 'vehicle'}</strong> — we hope you loved how easy it was!
            </Text>
            <Text style={text}>
              Here's the deal: <strong>share your experience</strong> with friends, family, and coworkers, and when they
              sell or trade their car with us, we'll send YOU a <strong>referral check or gift card for up to ${reward}</strong>! 🤑
            </Text>

            <Section style={howItWorksBox}>
              <Text style={howItWorksTitle}>How It Works</Text>
              <Text style={stepText}>1️⃣ <strong>Share your link</strong> — text it, email it, post it!</Text>
              <Text style={stepText}>2️⃣ <strong>They click &amp; sell</strong> — your friend starts their offer</Text>
              <Text style={stepText}>3️⃣ <strong>You get paid</strong> — up to ${reward} once they complete their sale!</Text>
            </Section>

            {referralLink && (
              <Section style={ctaSection}>
                <Text style={shareLabelText}>Your Personal Referral Link:</Text>
                <Section style={linkBox}>
                  <Text style={linkText}>{referralLink}</Text>
                </Section>
                <Button style={button} href={referralLink}>
                  Share My Link Now 🔗
                </Button>
              </Section>
            )}

            <Section style={tipBox}>
              <Text style={tipText}>
                💡 <strong>Pro tip:</strong> The more people you share with, the more you can earn.
                There's no limit to how many friends you can refer!
              </Text>
            </Section>

            <Hr style={hr} />
            <Text style={footer}>Happy earning! 🎊{'\n'}{dn}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ── Wrapper that picks the right variant ── */
const ReferralEmail = (props: Props) => (
  props.isStaffInvite
    ? React.createElement(StaffReferralEmail, props)
    : React.createElement(CustomerReferralEmail, props)
)

export const template = {
  component: ReferralEmail,
  subject: (data: Record<string, any>) =>
    data.isStaffInvite
      ? `${data.staffName || 'A friend'} recommends selling your car with ${data.dealershipName || SITE_NAME}!`
      : `You earned it — get up to $${data.rewardAmount || '200'} for every friend you refer!`,
  displayName: 'Customer referral invite',
  previewData: {
    customerName: 'Mike Johnson',
    referralLink: 'https://example.com/?ref=ABCD1234',
    rewardAmount: '200',
    dealershipName: 'Example Motors',
    staffName: 'Sarah from Example Motors',
    personalNote: "Hey Mike! I work at Example Motors and we're buying cars right now at great prices. I thought of you — it literally takes 2 minutes to get an offer. You should check it out!",
    isStaffInvite: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto' }
const header = { backgroundColor: 'hsl(210, 100%, 25%)', padding: '24px 25px', borderRadius: '12px 12px 0 0' }
const logoText = { color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const, letterSpacing: '2px', margin: '0', textAlign: 'center' as const }
const content = { padding: '32px 25px', border: '1px solid hsl(220, 13%, 91%)', borderTop: 'none', borderRadius: '0 0 12px 12px' }
const heroEmoji = { fontSize: '36px', textAlign: 'center' as const, margin: '0 0 16px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(210, 29%, 24%)', margin: '0 0 20px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: 'hsl(220, 9%, 46%)', lineHeight: '1.6', margin: '0 0 20px' }

const noteBox = { backgroundColor: '#f8fafc', borderLeft: '4px solid hsl(210, 100%, 25%)', borderRadius: '0 12px 12px 0', padding: '16px 20px', margin: '0 0 20px' }
const noteQuote = { fontSize: '15px', color: 'hsl(210, 29%, 24%)', fontStyle: 'italic' as const, lineHeight: '1.6', margin: '0 0 8px' }
const noteAttrib = { fontSize: '13px', color: 'hsl(220, 9%, 46%)', fontWeight: '600' as const, margin: '0' }

const benefitsBox = { backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '20px', margin: '0 0 24px', border: '1px solid #bbf7d0' }
const benefitsTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: 'hsl(210, 29%, 24%)', margin: '0 0 12px', textAlign: 'center' as const }
const benefitItem = { fontSize: '14px', color: 'hsl(210, 29%, 24%)', margin: '0 0 8px', lineHeight: '1.5' }

const rewardBox = { backgroundColor: '#fefce8', borderRadius: '8px', padding: '14px 16px', margin: '0 0 20px', border: '1px solid #fde68a' }
const rewardText = { fontSize: '13px', color: 'hsl(210, 29%, 24%)', margin: '0', lineHeight: '1.5' }
const subCtaText = { fontSize: '12px', color: 'hsl(220, 9%, 46%)', margin: '8px 0 0', textAlign: 'center' as const }

const howItWorksBox = { backgroundColor: '#f0f9ff', borderRadius: '12px', padding: '20px', margin: '0 0 24px', border: '1px solid #bae6fd' }
const howItWorksTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: 'hsl(210, 29%, 24%)', margin: '0 0 12px', textAlign: 'center' as const }
const stepText = { fontSize: '14px', color: 'hsl(210, 29%, 24%)', margin: '0 0 8px', lineHeight: '1.5' }

const ctaSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const shareLabelText = { fontSize: '12px', color: 'hsl(220, 9%, 46%)', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 8px', fontWeight: '600' as const }
const linkBox = { backgroundColor: 'hsl(210, 33%, 96%)', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px', border: '1px dashed hsl(220, 13%, 80%)' }
const linkText = { fontSize: '13px', color: 'hsl(210, 100%, 25%)', fontWeight: '600' as const, margin: '0', wordBreak: 'break-all' as const }
const button = { backgroundColor: 'hsl(142, 71%, 35%)', color: '#ffffff', fontSize: '15px', fontWeight: '700' as const, borderRadius: '12px', padding: '16px 32px', textDecoration: 'none' }

const tipBox = { backgroundColor: '#fefce8', borderRadius: '8px', padding: '14px 16px', margin: '0 0 20px', border: '1px solid #fde68a' }
const tipText = { fontSize: '13px', color: 'hsl(210, 29%, 24%)', margin: '0', lineHeight: '1.5' }

const hr = { borderColor: 'hsl(220, 13%, 91%)', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0', whiteSpace: 'pre-line' as const, textAlign: 'center' as const }
