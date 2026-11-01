/**
 * RooftopOS / AutoCurb Phase 1 PURE CONTRACT — NO RUNTIME INTEGRATION.
 *
 * PARKED outside supabase/functions, never deployed or imported by a live route.
 * Gateway agreement / AutoLabels PR #36/#46 pending final canonical catalog.
 * Do not wire to a transport until staging authorization and release review.
 */
export type App = "AutoLabels" | "AutoFilm" | "AutoCurb" | "AutoFrame";

export const SCHEMA_VERSION = "rooftop.v1" as const;
export const MAX_ENVELOPE_BYTES = 16_384;
export const LIVE_ROUTING_ENABLED = false as const;

export const CURB_ROUTES = {
  "vehicle.identity_updated": { source: "AutoLabels", target: "AutoCurb" },
  "vehicle.market_evidence_updated": { source: "AutoLabels", target: "AutoCurb" },
  "inspection.verified": { source: "AutoFilm", target: "AutoCurb" },
  "reconditioning.verified": { source: "AutoFilm", target: "AutoCurb" },
  "appraisal.recorded": { source: "AutoCurb", target: "AutoLabels" },
  "acquisition.recorded": { source: "AutoCurb", target: "AutoLabels" },
  "acquisition.intake_created": { source: "AutoCurb", target: "AutoFilm" },
} as const;

export type CurbEventType = keyof typeof CURB_ROUTES;

export interface CurbEvent {
  schema_version: typeof SCHEMA_VERSION;
  event_id: string;
  idempotency_key: string;
  tenant_id: string;
  rooftop_id: string;
  vehicle_instance_id: string;
  episode_id: string;
  vin: string;
  source_app: App;
  target_app: App;
  event_type: CurbEventType;
  source_revision: number;
  correlation_id: string;
  causation_id: string | null;
  occurred_at: string;
  emitted_at: string;
  payload_sha256: string;
  payload: Record<string, unknown>;
}

export interface VerifiedConnection {
  /** Resolved from the authenticated connection, NEVER trusted from the payload. */
  tenant_id: string;
  rooftop_id: string;
  source_app: App;
  target_app: App;
  enabled: boolean;
}

export type DeliveryDecision = "apply" | "duplicate" | "stale";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const HEX_SHA256 = /^[a-f0-9]{64}$/i;
const SENSITIVE_KEYS = new Set([
  "email", "phone", "mobile", "first_name", "last_name", "full_name",
  "customer_name", "customer_email", "customer_phone", "address",
  "street", "ssn", "dob", "birth_date", "password", "token", "secret",
  "access_token", "refresh_token", "authorization", "card_number",
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) =>
    SENSITIVE_KEYS.has(key.toLowerCase()) || containsSensitiveKey(nested),
  );
}

/** Validation is NOT authentication. Call authorizeAgainstConnection afterward. */
export function validateCurbEvent(input: unknown): CurbEvent {
  if (!isRecord(input)) throw new Error("invalid_envelope");
  const encoded = new TextEncoder().encode(JSON.stringify(input));
  if (encoded.byteLength > MAX_ENVELOPE_BYTES) throw new Error("payload_too_large");
  const event = input as unknown as CurbEvent;
  if (event.schema_version !== SCHEMA_VERSION) throw new Error("unsupported_schema_version");
  const ids = [
    event.event_id, event.tenant_id, event.rooftop_id, event.vehicle_instance_id,
    event.episode_id, event.correlation_id,
  ];
  if (ids.some(id => typeof id !== "string" || !UUID.test(id))) throw new Error("invalid_identity");
  if (event.causation_id != null && !UUID.test(event.causation_id)) throw new Error("invalid_causation");
  if (typeof event.idempotency_key !== "string" || !event.idempotency_key.trim() ||
      event.idempotency_key.length > 128) throw new Error("invalid_idempotency_key");
  if (typeof event.vin !== "string" || !VIN.test(event.vin)) throw new Error("invalid_vin");
  if (!Number.isSafeInteger(event.source_revision) || event.source_revision < 1) {
    throw new Error("invalid_revision");
  }
  if (typeof event.payload_sha256 !== "string" || !HEX_SHA256.test(event.payload_sha256)) {
    throw new Error("invalid_payload_hash");
  }
  if (!isRecord(event.payload) || containsSensitiveKey(event.payload)) {
    throw new Error("invalid_or_sensitive_payload");
  }
  if (typeof event.occurred_at !== "string" || Number.isNaN(Date.parse(event.occurred_at)) ||
      typeof event.emitted_at !== "string" || Number.isNaN(Date.parse(event.emitted_at))) {
    throw new Error("invalid_timestamp");
  }
  if (typeof event.event_type !== "string" ||
      !Object.prototype.hasOwnProperty.call(CURB_ROUTES, event.event_type)) {
    throw new Error("unsupported_event_type");
  }
  const route = CURB_ROUTES[event.event_type];
  if (route.source !== event.source_app || route.target !== event.target_app) {
    throw new Error("field_authority_violation");
  }
  return event;
}

/** The server must verify raw-byte signature and bind the signing key to this connection first. */
export function authorizeAgainstConnection(event: CurbEvent, connection: VerifiedConnection): void {
  if (!connection.enabled) throw new Error("direction_disabled");
  if (connection.tenant_id !== event.tenant_id ||
      connection.rooftop_id !== event.rooftop_id) throw new Error("tenant_scope_denied");
  if (connection.source_app !== event.source_app ||
      connection.target_app !== event.target_app) throw new Error("app_impersonation_denied");
}

/** Watermark must be scoped to tenant + instance + source + event type/aggregate in storage. */
export function decideApply(
  event: CurbEvent,
  lastSourceRevision: number | null,
  eventIdAlreadyApplied: boolean,
): DeliveryDecision {
  if (eventIdAlreadyApplied) return "duplicate";
  if (lastSourceRevision !== null && event.source_revision <= lastSourceRevision) return "stale";
  return "apply";
}

/** Bounded, deterministic base. Persistent workers apply bounded jitter separately. */
export function nextRetryDelayMs(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error("invalid_attempt");
  return Math.min(6 * 60 * 60_000, 60_000 * 2 ** Math.min(attempt - 1, 20));
}

export function shouldDeadLetter(attempt: number): boolean {
  return attempt >= 8;
}

/** Deliberate zero-action default; enabling requires a separate reviewed server implementation. */
export function mayUseLiveTransport(): false {
  return LIVE_ROUTING_ENABLED;
}
