// Communication channel toggles — shared client.
//
// Mirrors the migration `20260429120000_channel_settings.sql`. When
// you add a new channel, update both files and any UI that needs
// gating.

export const CHANNEL_KEYS = [
  "two_way_sms",
  "two_way_email",
  "ai_phone_calls",
  "click_to_dial",
] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

export interface ChannelMeta {
  key: ChannelKey;
  label: string;
  description: string;
}

export const CHANNEL_META: Record<ChannelKey, ChannelMeta> = {
  two_way_sms: {
    key: "two_way_sms",
    label: "Two-way SMS",
    description: "Staff can send and receive SMS replies inside the customer file.",
  },
  two_way_email: {
    key: "two_way_email",
    label: "Two-way Email",
    description: "Staff can compose and reply to customer emails inside the customer file.",
  },
  ai_phone_calls: {
    key: "ai_phone_calls",
    label: "AI phone calls",
    description: "Outbound and inbound AI voice agent (calling, qualifying, scheduling).",
  },
  click_to_dial: {
    key: "click_to_dial",
    label: "Click-to-dial",
    description: "Staff click a customer's phone to bridge a Twilio call between their cell and the customer.",
  },
};

export type ChannelStateMap = Record<ChannelKey, boolean>;

export const ALL_ENABLED: ChannelStateMap = {
  two_way_sms: true,
  two_way_email: true,
  ai_phone_calls: true,
  click_to_dial: true,
};
