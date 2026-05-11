/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Img, Section, Text } from 'npm:@react-email/components@0.0.22'

import { MASCOT_URLS, type DealerMascotPose } from '../dealer-mascot.ts'

interface Props {
  pose: DealerMascotPose
  brand?: string  // wordmark text under the mascot; defaults to 'AUTOCURB'.
}

export const DealerMascotHeader = ({ pose, brand = 'AUTOCURB' }: Props) => (
  <Section style={header}>
    <Img
      src={MASCOT_URLS[pose]}
      alt=""
      width="120"
      height="60"
      style={mascot}
    />
    <Text style={logoText}>{brand}</Text>
  </Section>
)

export default DealerMascotHeader

const header = {
  backgroundColor: 'hsl(210, 100%, 25%)',
  padding: '20px 25px 24px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const mascot = {
  display: 'block',
  margin: '0 auto 8px',
  maxWidth: '120px',
  height: 'auto',
}
const logoText = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 'bold' as const,
  letterSpacing: '2px',
  margin: '0',
  textAlign: 'center' as const,
}
