// Pre-commit gate. Runs on every `git commit` via husky → lint-staged.
//
// Goals:
//   1. Catch regex-mangling / accidental-syntax bugs before they
//      reach CI. ESLint covers no-unused-expressions, no-constant-
//      binary-expression, parse errors, and the like.
//   2. Catch typecheck regressions before they reach the Verify CI
//      job. Especially important now that CI's Verify actually
//      typechecks (see .github/workflows/ci.yml — it points at
//      tsconfig.app.json explicitly because bare `tsc --noEmit`
//      against the root tsconfig.json is a no-op).
//   3. Stay fast — only run when staged .ts/.tsx files exist; skip
//      entirely for doc/config-only commits.
//
// Intentionally NOT in pre-commit:
//   • Full test suite — CI covers it; gating commits on tests would
//     push the local commit loop into the 5–10s range.

export default {
  // Two tasks per glob run sequentially:
  //   1. ESLint --fix on each staged file (auto-applies fixable
  //      rules, re-stages, fails on real errors).
  //   2. Project-wide typecheck (no file args — tsc needs the full
  //      import graph). Uses tsconfig.app.json explicitly for the
  //      same reason CI does.
  "*.{ts,tsx}": [
    "eslint --fix",
    () => "tsc --noEmit -p tsconfig.app.json --pretty false",
  ],
};
