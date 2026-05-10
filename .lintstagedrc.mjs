// Pre-commit gate. Runs on every `git commit` via husky → lint-staged.
//
// Goals:
//   1. Catch the regex-paren-eating / accidental-mangling pattern that
//      bit us across batches 5–8 before it reaches CI. Lint covers
//      no-unused-expressions / no-constant-binary-expression /
//      syntax errors that surface those bugs.
//   2. Stay fast — only run on staged files.
//
// Intentionally NOT run here:
//   • Full test suite — CI covers it; gating commits on tests would
//     push the local commit loop into the 5–10s range.
//   • `tsc -p tsconfig.app.json` — currently surfaces 115 pre-existing
//     type errors that CI has been silently ignoring (root tsconfig.json
//     has `files: []` with project references, so `tsc --noEmit` against
//     it compiles nothing). Adding a strict typecheck here would block
//     every commit until that backlog is cleared. The fix has two parts:
//     (a) sweep the 115 errors (mostly stale column references and
//         missing fields in local types), and
//     (b) update the CI workflow to use `tsc -p tsconfig.app.json` so
//         the typecheck job actually checks something.
//     That's a separate effort. For now, lint catches the bugs we
//     actually saw in batches 5–8 (regex-mangled function calls).

export default {
  // ESLint --fix per-staged-file. Auto-fixable lints get applied and
  // re-staged automatically. Real errors fail the hook.
  "*.{ts,tsx}": ["eslint --fix"],
};
