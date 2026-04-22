/**
 * API Access utilities for enterprise API key management.
 */

/**
 * Generates a secure random API key prefixed with `hc_`.
 */
export function generateApiKey(): string {
  const uuid1 = crypto.randomUUID().replace(/-/g, "");
  const uuid2 = crypto.randomUUID().replace(/-/g, "");
  return `hc_${uuid1}${uuid2}`;
}

/**
 * Masks an API key for display: shows first 3 + last 4 chars.
 * Example: `hc_****...****`  →  `hc_a1b...f4g2`
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 10) return "hc_****...****";
  const first3 = key.slice(0, 6); // "hc_" + 3 chars
  const last4 = key.slice(-4);
  return `${first3}****...****${last4}`;
}

export const API_ENDPOINTS = [
  { method: "GET" as const, path: "/api/submissions", description: "List all submissions", scopes: ["read:submissions"] },
  { method: "GET" as const, path: "/api/submissions/:id", description: "Get submission details", scopes: ["read:submissions"] },
  { method: "POST" as const, path: "/api/submissions", description: "Create a submission", scopes: ["write:submissions"] },
  { method: "PUT" as const, path: "/api/submissions/:id/status", description: "Update submission status", scopes: ["write:submissions"] },
  { method: "GET" as const, path: "/api/appointments", description: "List appointments", scopes: ["read:appointments"] },
  { method: "POST" as const, path: "/api/webhooks", description: "Register a webhook", scopes: ["admin:webhooks"] },
] as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[number];

export const WEBHOOK_EVENT_TYPES = [
  { key: "new_submission", label: "New Submission", description: "Fires when a new lead is submitted" },
  { key: "status_changed", label: "Status Changed", description: "Fires when a lead status is updated" },
  { key: "deal_completed", label: "Deal Completed", description: "Fires when a deal is marked complete" },
  { key: "appointment_booked", label: "Appointment Booked", description: "Fires when an appointment is scheduled" },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]["key"];

export interface WebhookConfig {
  url: string;
  events: WebhookEventType[];
  is_active: boolean;
}
