// Tests for the role-gating helpers in adminConstants.
//
// These predicates are the canonical authority for "which roles can do X"
// across the entire admin UI — pricing-edit gates, queue access, the
// appraisal tool, the executive HUD, etc. A regression here directly
// weakens or breaks the platform's authorization model.
//
// Pinning the answers for every published role × every helper means a
// future role-mapping change can't silently grant or revoke access
// without one of these tests catching it.

import { describe, it, expect } from "vitest";
import {
  isManagerRole,
  isPricingRole,
  isApprovalRole,
  isSalesFloorRole,
  isBDCRole,
  isSalesRole,
  canViewPricing,
  MANAGER_ROLES,
  PRICING_ROLES,
  APPROVAL_ROLES,
  SALES_FLOOR_ROLES,
  PRICING_VIEW_ROLES,
} from "@/lib/adminConstants";

// Every role string the platform recognises. Adding a new role here
// also means adding a row to the gate matrix below.
const ALL_ROLES = [
  "admin",
  "platform_admin",
  "gm",
  "gsm_gm",
  "used_car_manager",
  "new_car_manager",
  "internet_manager",
  "appraiser",
  "sales",
  "sales_bdc",
  "receptionist",
  "service_advisor",
] as const;

// Falsy / unknown inputs that every helper must reject.
const FALSY: (string | null | undefined)[] = [null, undefined, "", "Admin" /* wrong case */, "not_a_role"];

// ─────────────────────────────────────────────────────────────
// Constant-set sanity (catches accidental drift in the `as const` arrays)
// ─────────────────────────────────────────────────────────────
describe("role constant sets", () => {
  it("MANAGER_ROLES is exactly the 4 manager-tier roles", () => {
    expect([...MANAGER_ROLES].sort()).toEqual(
      ["used_car_manager", "new_car_manager", "gsm_gm", "gm"].sort(),
    );
  });

  it("PRICING_ROLES is admin + every manager role (strict superset of MANAGER_ROLES)", () => {
    for (const r of MANAGER_ROLES) expect(PRICING_ROLES).toContain(r);
    expect(PRICING_ROLES).toContain("admin");
  });

  it("APPROVAL_ROLES is admin + gsm_gm + gm only (strict subset of PRICING_ROLES)", () => {
    expect([...APPROVAL_ROLES].sort()).toEqual(["admin", "gm", "gsm_gm"].sort());
    for (const r of APPROVAL_ROLES) expect(PRICING_ROLES).toContain(r);
  });

  it("SALES_FLOOR_ROLES is exactly sales + sales_bdc", () => {
    expect([...SALES_FLOOR_ROLES].sort()).toEqual(["sales", "sales_bdc"].sort());
  });

  it("PRICING_VIEW_ROLES contains all of PRICING_ROLES, SALES_FLOOR_ROLES, and 'appraiser'", () => {
    for (const r of PRICING_ROLES) expect(PRICING_VIEW_ROLES).toContain(r);
    for (const r of SALES_FLOOR_ROLES) expect(PRICING_VIEW_ROLES).toContain(r);
    expect(PRICING_VIEW_ROLES).toContain("appraiser");
  });
});

// ─────────────────────────────────────────────────────────────
// Per-helper truth table — pin the answer for every (helper, role) cell
// ─────────────────────────────────────────────────────────────

// Each row is one role; columns are which gates should evaluate true.
// If a column is NOT listed, that helper must return false for that role.
const GATE_MATRIX: Record<(typeof ALL_ROLES)[number], readonly string[]> = {
  admin:             ["isPricingRole", "isApprovalRole", "canViewPricing"],
  platform_admin:    [], // platform_admin is not a dealership-level role; none of these gates fire on it
  gm:                ["isManagerRole", "isPricingRole", "isApprovalRole", "canViewPricing"],
  gsm_gm:            ["isManagerRole", "isPricingRole", "isApprovalRole", "canViewPricing"],
  used_car_manager:  ["isManagerRole", "isPricingRole", "canViewPricing"],
  new_car_manager:   ["isManagerRole", "isPricingRole", "canViewPricing"],
  internet_manager:  [],
  appraiser:         ["canViewPricing"],
  sales:             ["isSalesFloorRole", "isSalesRole", "canViewPricing"],
  sales_bdc:         ["isSalesFloorRole", "isBDCRole", "canViewPricing"],
  receptionist:      [],
  service_advisor:   [],
};

const HELPERS = {
  isManagerRole,
  isPricingRole,
  isApprovalRole,
  isSalesFloorRole,
  isBDCRole,
  isSalesRole,
  canViewPricing,
} as const;

describe("role gate matrix — every role × every helper", () => {
  for (const role of ALL_ROLES) {
    const allowed = new Set(GATE_MATRIX[role]);
    for (const [name, fn] of Object.entries(HELPERS)) {
      const expected = allowed.has(name);
      it(`${name}("${role}") → ${expected}`, () => {
        expect(fn(role)).toBe(expected);
      });
    }
  }
});

// ─────────────────────────────────────────────────────────────
// Falsy / unknown inputs — every helper must return false
// ─────────────────────────────────────────────────────────────
describe("role gates — falsy and unknown inputs are always rejected", () => {
  for (const [name, fn] of Object.entries(HELPERS)) {
    for (const input of FALSY) {
      it(`${name}(${JSON.stringify(input)}) → false`, () => {
        expect(fn(input)).toBe(false);
      });
    }
  }
});
