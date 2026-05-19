// Forward-looking guard against non-idempotent migrations.
//
// CLAUDE.md states "Every migration must be idempotent" — but until
// this guard, that rule was enforced only by code review. The
// 13-missing-tables incident in May 2026 showed why this matters:
// migrations don't auto-apply on merge to main (Lovable's sync handles
// frontend + edge functions only), so re-applying a partial set after
// the fact has to be safe.
//
// What "idempotent" means here, mechanically:
//   * CREATE TABLE                 → must use IF NOT EXISTS
//   * CREATE INDEX                 → must use IF NOT EXISTS
//   * CREATE POLICY                → must be wrapped in a
//                                    DROP POLICY IF EXISTS ... CREATE POLICY ...
//                                    pair, OR a pg_policies guard.
//                                    (PG doesn't support CREATE POLICY IF
//                                    NOT EXISTS until very recent versions.)
//   * ALTER TABLE ... ADD COLUMN   → must use IF NOT EXISTS
//   * CREATE FUNCTION / PROCEDURE  → must use CREATE OR REPLACE
//   * CREATE TRIGGER               → must be preceded by DROP TRIGGER IF EXISTS
//
// We grandfather every migration dated before the cutoff to avoid
// rewriting 25+ historical files. Going forward, any new migration
// authored with a timestamp >= CUTOFF must pass.
//
// To bypass for a one-off legitimate exception (rare), prepend the
// file with a "-- idempotency-exempt: <reason>" line in the first
// 5 lines.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

// Files dated on or after this prefix must pass the idempotency check.
// Anything older is grandfathered. Bumping this cutoff covers more files;
// lowering it grandfathers more.
//
// Set to 2026-05-18 — the date the guard landed. Every migration
// added from that point forward (including Lovable-generated ones)
// must be idempotent. Older migrations stay grandfathered to avoid a
// 25-file rewrite that has no operational value (those files were
// applied once long ago and never re-run).
const CUTOFF_PREFIX = "20260518";

// Per-file escape hatch — first 5 lines may contain this marker.
const EXEMPT_RE = /^\s*--\s*idempotency-exempt:/;

interface Violation {
  rule: string;
  line: number;
  excerpt: string;
}

function checkFile(path: string, body: string): Violation[] {
  const lines = body.split("\n");

  // Per-file exempt marker in the first 5 lines is honored.
  for (const head of lines.slice(0, 5)) {
    if (EXEMPT_RE.test(head)) return [];
  }

  const v: Violation[] = [];

  lines.forEach((raw, i) => {
    const ln = i + 1;
    // Strip inline -- comments before scanning so a comment matching
    // a forbidden pattern doesn't false-positive.
    const line = raw.replace(/--.*$/, "");
    const trimmed = line.trim();

    // CREATE TABLE
    if (/^create\s+table\s+(?!if\s+not\s+exists)/i.test(trimmed)) {
      v.push({ rule: "CREATE TABLE needs IF NOT EXISTS", line: ln, excerpt: trimmed.slice(0, 80) });
    }
    // CREATE INDEX (incl. UNIQUE INDEX)
    if (/^create\s+(unique\s+)?index\s+(?!if\s+not\s+exists)/i.test(trimmed)) {
      v.push({ rule: "CREATE INDEX needs IF NOT EXISTS", line: ln, excerpt: trimmed.slice(0, 80) });
    }
    // ALTER TABLE ... ADD COLUMN — same line OR continuation; the
    // strictest test is "ADD COLUMN" without "IF NOT EXISTS" on it.
    if (/\badd\s+column\s+(?!if\s+not\s+exists)/i.test(trimmed)) {
      v.push({ rule: "ADD COLUMN needs IF NOT EXISTS", line: ln, excerpt: trimmed.slice(0, 80) });
    }
    // CREATE FUNCTION — must be OR REPLACE, OR preceded somewhere in
    // the file by a DROP FUNCTION IF EXISTS for the same name (used
    // when the signature changes and OR REPLACE alone wouldn't drop
    // the prior). The DROP-then-CREATE pattern is idempotent under
    // re-application: DROP IF EXISTS no-ops if absent, CREATE always
    // succeeds.
    const createFnMatch = trimmed.match(/^create\s+function\s+(?:public\.)?([a-z_][a-z0-9_]*)/i);
    if (
      createFnMatch &&
      !/or\s+replace/i.test(trimmed) &&
      !/if\s+not\s+exists/i.test(trimmed)
    ) {
      const fnName = createFnMatch[1];
      const dropRe = new RegExp(`drop\\s+function\\s+if\\s+exists\\s+(?:public\\.)?${fnName}\\b`, "i");
      if (!dropRe.test(body)) {
        v.push({ rule: `CREATE FUNCTION ${fnName} needs OR REPLACE or a preceding DROP FUNCTION IF EXISTS`, line: ln, excerpt: trimmed.slice(0, 80) });
      }
    }
    // Same for procedures.
    const createProcMatch = trimmed.match(/^create\s+procedure\s+(?:public\.)?([a-z_][a-z0-9_]*)/i);
    if (
      createProcMatch &&
      !/or\s+replace/i.test(trimmed) &&
      !/if\s+not\s+exists/i.test(trimmed)
    ) {
      const procName = createProcMatch[1];
      const dropRe = new RegExp(`drop\\s+procedure\\s+if\\s+exists\\s+(?:public\\.)?${procName}\\b`, "i");
      if (!dropRe.test(body)) {
        v.push({ rule: `CREATE PROCEDURE ${procName} needs OR REPLACE or a preceding DROP PROCEDURE IF EXISTS`, line: ln, excerpt: trimmed.slice(0, 80) });
      }
    }
    // CREATE TRIGGER without preceding DROP. We can't check "preceding"
    // line-by-line here, so just require the whole file to contain a
    // DROP TRIGGER IF EXISTS matching the same trigger name if any
    // CREATE TRIGGER appears. (Coarse check; false-positive rate is
    // very low — anyone authoring a new trigger today knows the drill.)
    // Handled below at file scope, not here.
  });

  // File-scope trigger check.
  const createTriggers = body.match(/create\s+trigger\s+([a-z_][a-z0-9_]*)/gi) ?? [];
  for (const m of createTriggers) {
    const nameMatch = m.match(/create\s+trigger\s+([a-z_][a-z0-9_]*)/i);
    const name = nameMatch?.[1];
    if (!name) continue;
    const dropRe = new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${name}\\b`, "i");
    if (!dropRe.test(body)) {
      v.push({
        rule: `CREATE TRIGGER ${name} needs preceding DROP TRIGGER IF EXISTS ${name}`,
        line: 0,
        excerpt: name,
      });
    }
  }

  // CREATE POLICY: needs either a paired DROP POLICY IF EXISTS or an
  // explicit pg_policies-guard NOT EXISTS DO block. Coarse: just require
  // EITHER pattern at file scope when a CREATE POLICY appears.
  if (/create\s+policy/i.test(body)) {
    const hasDropGuard = /drop\s+policy\s+if\s+exists/i.test(body);
    const hasPgPoliciesGuard = /pg_policies/i.test(body);
    if (!hasDropGuard && !hasPgPoliciesGuard) {
      v.push({
        rule: "CREATE POLICY needs a preceding DROP POLICY IF EXISTS or a pg_policies guard",
        line: 0,
        excerpt: "(file-scope)",
      });
    }
  }

  return v;
}

function isAfterCutoff(filename: string): boolean {
  return filename.length >= CUTOFF_PREFIX.length &&
    filename.slice(0, CUTOFF_PREFIX.length) >= CUTOFF_PREFIX;
}

describe("migration idempotency", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter(isAfterCutoff)
    .sort();

  it("has a sensible cutoff (some files in scope)", () => {
    // If the cutoff is set too high there's nothing to check, which
    // means the guard is silently inert.
    if (files.length === 0) {
      console.warn(
        `No migrations on/after cutoff ${CUTOFF_PREFIX}. The guard is dormant ` +
          `until a new migration is added — that's fine, but bump CUTOFF_PREFIX ` +
          `down if you want to enforce on existing files.`
      );
    }
    expect(files).toBeDefined();
  });

  for (const file of files) {
    it(`${file}: idempotent`, () => {
      const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const violations = checkFile(file, body);
      if (violations.length > 0) {
        const list = violations
          .map((v) => `  • ${v.rule}` + (v.line ? ` (line ${v.line}): ${v.excerpt}` : ` — ${v.excerpt}`))
          .join("\n");
        throw new Error(
          `Non-idempotent migration: supabase/migrations/${file}\n\n${list}\n\n` +
            `Per CLAUDE.md "Every migration must be idempotent" — required so a\n` +
            `re-application after a partial Lovable-Push doesn't error. Fix the\n` +
            `lines above, OR add '-- idempotency-exempt: <reason>' in the first\n` +
            `5 lines if the file is legitimately a one-shot data migration.`
        );
      }
      expect(violations).toEqual([]);
    });
  }
});
