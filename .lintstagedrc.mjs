// Pre-commit gate. Runs on every `git commit` via husky → lint-staged.
//
// Goals:
//   1. Catch the regex-paren-eating / accidental-mangling pattern that
//      bit us across batches 5–8 before it reaches CI. Lint covers
//      no-unused-expressions / no-constant-binary-expression /
//      syntax errors that surface those bugs.
//   2. Catch typecheck regressions before they hit CI. The 115-error
//      backlog uncovered when the hook was first added is now cleared
//      (see commit f409216 + follow-ups), so we can turn the
//      typecheck step back on.
//   3. Stay fast — only run when relevant files are actually staged.
//
// We intentionally do NOT run the full test suite on every commit.
// CI covers it; gating commits on tests would push the local commit
// loop into the 5–10s range, which discourages incremental commits.

export default {
  // Two tasks run sequentially per staged file glob:
  //   1. ESLint --fix per-staged-file. Auto-fixable lints get applied
  //      and re-staged. Real errors fail the hook.
  //   2. Project-wide typecheck (no file args — tsc needs the full
  //      import graph). Uses tsconfig.app.json explicitly because the
  //      root tsconfig.json has `files: []` and project references,
  //      which makes `tsc --noEmit` against it a no-op. Pointing here
  //      explicitly ensures we actually compile.
  "*.{ts,tsx}": [
    "eslint --fix",
    () => "tsc --noEmit -p tsconfig.app.json --pretty false",
  ],
};
