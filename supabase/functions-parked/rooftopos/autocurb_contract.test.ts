import { describe, expect, it } from "vitest";
import {
  authorizeAgainstConnection,
  decideApply,
  mayUseLiveTransport,
  nextRetryDelayMs,
  shouldDeadLetter,
  validateCurbEvent,
  type CurbEvent,
  type VerifiedConnection,
} from "./autocurb_contract";

const ID = {
  event: "00000000-0000-4000-8000-000000000101",
  tenant: "00000000-0000-4000-8000-000000000102",
  rooftop: "00000000-0000-4000-8000-000000000103",
  instance: "00000000-0000-4000-8000-000000000104",
  episode: "00000000-0000-4000-8000-000000000105",
  correlation: "00000000-0000-4000-8000-000000000106",
} as const;

const base: CurbEvent = {
  schema_version: "rooftop.v1",
  event_id: ID.event,
  idempotency_key: "synthetic-001",
  tenant_id: ID.tenant,
  rooftop_id: ID.rooftop,
  vehicle_instance_id: ID.instance,
  episode_id: ID.episode,
  vin: "1HGCM82633A004352",
  source_app: "AutoCurb",
  target_app: "AutoLabels",
  event_type: "acquisition.recorded",
  source_revision: 2,
  correlation_id: ID.correlation,
  causation_id: null,
  occurred_at: "2026-11-01T00:00:00Z",
  emitted_at: "2026-11-01T00:00:01Z",
  payload_sha256: "a".repeat(64),
  payload: { acquisition_ref: "synthetic-acq-1", status: "accepted" },
};

const connection: VerifiedConnection = {
  tenant_id: ID.tenant,
  rooftop_id: ID.rooftop,
  source_app: "AutoCurb",
  target_app: "AutoLabels",
  enabled: true,
};

describe("parked AutoCurb RooftopOS contract — no live side effects", () => {
  it("accepts a valid minimal acquisition event", () => {
    expect(validateCurbEvent(base).event_id).toBe(ID.event);
    expect(() => authorizeAgainstConnection(base, connection)).not.toThrow();
  });

  it("rejects wrong tenant, wrong rooftop, and source impersonation", () => {
    expect(() => authorizeAgainstConnection(base, { ...connection, tenant_id: "wrong" }))
      .toThrow("tenant_scope_denied");
    expect(() => authorizeAgainstConnection(base, { ...connection, rooftop_id: "wrong" }))
      .toThrow("tenant_scope_denied");
    expect(() => authorizeAgainstConnection(base, { ...connection, source_app: "AutoFilm" }))
      .toThrow("app_impersonation_denied");
  });

  it("rejects every disabled direction", () => {
    expect(() => authorizeAgainstConnection(base, { ...connection, enabled: false }))
      .toThrow("direction_disabled");
    expect(mayUseLiveTransport()).toBe(false);
  });

  it("rejects unsupported event source/target combinations and schema revisions", () => {
    expect(() => validateCurbEvent({ ...base, source_app: "AutoFilm" }))
      .toThrow("field_authority_violation");
    expect(() => validateCurbEvent({ ...base, event_type: "unknown" }))
      .toThrow("unsupported_event_type");
    expect(() => validateCurbEvent({ ...base, schema_version: "rooftop.v2" }))
      .toThrow("unsupported_schema_version");
  });

  it("rejects PII anywhere in nested payload and oversized event bodies", () => {
    expect(() => validateCurbEvent({ ...base, payload: { nested: { customer_phone: "555-1234" } } }))
      .toThrow("invalid_or_sensitive_payload");
    expect(() => validateCurbEvent({ ...base, payload: { notes: "x".repeat(17000) } }))
      .toThrow("payload_too_large");
  });

  it("keeps same VIN separate by instance and tenant", () => {
    const second = validateCurbEvent({
      ...base,
      event_id: "00000000-0000-4000-8000-000000000111",
      vehicle_instance_id: "00000000-0000-4000-8000-000000000112",
    });
    expect(second.vin).toBe(base.vin);
    expect(second.vehicle_instance_id).not.toBe(base.vehicle_instance_id);
  });

  it("never treats duplicate or stale source revision as another applied effect", () => {
    expect(decideApply(base, 1, false)).toBe("apply");
    expect(decideApply(base, 2, false)).toBe("stale");
    expect(decideApply(base, 3, false)).toBe("stale");
    expect(decideApply(base, 1, true)).toBe("duplicate");
  });

  it("uses bounded exponential backoff and dead-letters at eight attempts", () => {
    expect(nextRetryDelayMs(1)).toBe(60000);
    expect(nextRetryDelayMs(2)).toBe(120000);
    expect(nextRetryDelayMs(8)).toBe(7680000);
    expect(nextRetryDelayMs(999)).toBe(21600000);
    expect(shouldDeadLetter(7)).toBe(false);
    expect(shouldDeadLetter(8)).toBe(true);
  });

  it("keeps historical sold instances immutable by contract: no inventory activation route", () => {
    expect(() => validateCurbEvent({ ...base, event_type: "inventory.reactivated" }))
      .toThrow("unsupported_event_type");
  });
});
