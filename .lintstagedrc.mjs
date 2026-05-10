// Pre-commit gate. Runs on every `git commit` via husky → lint-staged.
//
// Goals:
//   1. Catch the regex-paren-eating / accidental-mangling pattern that
//      bit us across batches 5–8 before it reaches CI. Lint already
//      covers the no-unused-expressions / no-constant-binary-expression
//      classes that surface those bugs.
//   2. Catch typecheck regressions before they hit the Verify CI job.
//   3. Stay fast — only run tsc when .ts/.tsx files are staged.
//
// We intentionally do NOT run the full test suite on every commit. CI
// covers that; gating commits on test runs would push the local commit
// loop into the 5–10-second range, which discourages incremental
// commits.

export default {
  // Two tasks per glob run sequentially:
  //   1. ESLint --fix per-staged-file. Auto-fixable lints get applied
  //      and re-staged. Real errors fail the hook.
  //   2. tsc for the whole project (function-style returns a command
  //      with no file args, so tsc uses tsconfig.app.json normally).
  //      Without this, type errors only surface in CI.
  "*.{ts,tsx}": [
    "eslint --fix",
    () => "tsc --noEmit -p tsconfig.app.json --pretty false",
  ],
};
