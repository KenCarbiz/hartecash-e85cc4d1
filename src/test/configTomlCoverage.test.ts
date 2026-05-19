// Guards against the recurring "edge function shipped without a
// config.toml entry → gateway 401s the customer" incident.
//
// History:
//   * PR #249 — send-customer-otp + verify-customer-otp shipped
//     without entries; entire Moto OTP flow was dead.
//   * PR #250 — sweep found 7 more (parse-drivers-license, parse-
//     title-vin, verify-shot-photo, book-appointment, boost-evaluate,
//     generate-vehicle-image, handle-unsubscribe). The handle-
//     unsubscribe miss is a TCPA/CAN-SPAM compliance exposure.
//
// Failure mode: a function not in config.toml defaults to
// verify_jwt=true. Customer-facing flows have no auth session, so
// every call gets 401-rejected at the gateway BEFORE the function
// runs — meaning zero invocation logs and a totally silent failure
// from the dev's perspective.
//
// This test enforces: every directory under supabase/functions/
// (except _shared) MUST have either:
//   1. A [functions.NAME] block in supabase/config.toml, OR
//   2. An explicit "@jwt-required" annotation in the first 40 lines
//      of its index.ts, declaring that the author intentionally
//      relies on the default behavior.
//
// Path #2 is provided so we don't force config.toml entries for
// purely admin/cron functions where verify_jwt=true is correct —
// the dev just has to say so out loud.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const FUNCTIONS_DIR = join(REPO_ROOT, "supabase", "functions");
const CONFIG_TOML = join(REPO_ROOT, "supabase", "config.toml");

function listFunctionDirs(): string[] {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => !name.startsWith("_"))
    .filter((name) => {
      try {
        return statSync(join(FUNCTIONS_DIR, name)).isDirectory();
      } catch {
        return false;
      }
    });
}

function configToml(): string {
  return readFileSync(CONFIG_TOML, "utf8");
}

function hasConfigBlock(toml: string, fnName: string): boolean {
  const escaped = fnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\[functions\\.${escaped}\\]`).test(toml);
}

function hasJwtRequiredAnnotation(fnName: string): boolean {
  try {
    const body = readFileSync(join(FUNCTIONS_DIR, fnName, "index.ts"), "utf8");
    // Require the annotation in the first 40 lines (top-of-file
    // comment block) so a buried mention in implementation code
    // doesn't accidentally satisfy the gate.
    const head = body.split("\n").slice(0, 40).join("\n");
    return /@jwt-required\b/.test(head);
  } catch {
    return false;
  }
}

describe("supabase config.toml coverage", () => {
  const toml = configToml();
  const fns = listFunctionDirs();

  it("has at least one function directory to check", () => {
    expect(fns.length).toBeGreaterThan(0);
  });

  // One assertion per function so a failure tells you EXACTLY which
  // one slipped through, not "X functions missing".
  for (const fn of fns) {
    it(`${fn}: declared in config.toml OR carries an @jwt-required annotation`, () => {
      const inConfig = hasConfigBlock(toml, fn);
      const annotated = hasJwtRequiredAnnotation(fn);
      if (!inConfig && !annotated) {
        throw new Error(
          `supabase/functions/${fn}/ has no [functions.${fn}] block in supabase/config.toml ` +
            `AND no '@jwt-required' annotation in the first 40 lines of its index.ts.\n\n` +
            `Pick one:\n` +
            `  a) If customer/anonymous-facing: add to config.toml as\n` +
            `       [functions.${fn}]\n` +
            `         verify_jwt = false\n` +
            `     with a comment explaining who calls it and how it self-authenticates.\n\n` +
            `  b) If admin/cron-only and the default verify_jwt=true is correct:\n` +
            `     add '// @jwt-required' at the top of index.ts to declare the intent.\n\n` +
            `See PRs #249 / #250 for the incident history this test is preventing.`
        );
      }
      expect(inConfig || annotated).toBe(true);
    });
  }
});
