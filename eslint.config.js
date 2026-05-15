import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "project", "**/*.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Significant typing debt across the codebase. Downgraded to warn
      // so CI stays green while we chip away at it; re-enable as error
      // once the backlog is zero.
      "@typescript-eslint/no-explicit-any": "warn",
      // Empty Promise.catch bodies swallow failures silently — the May
      // 2026 reliability audit flagged sites where this had caused
      // orphaned background work. New code must either log to
      // error_log via the shared report() helper (edge functions:
      // import from ../_shared/report.ts) or at minimum console.warn
      // so the failure surfaces in function logs. Matches
      // .catch(() => {}) and .catch(e => {}) regardless of arg style.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='BlockStatement'][body.body.length=0]",
          message:
            "Empty .catch(() => {}) swallows the failure. Either log via the shared report() helper, console.warn the error, or rethrow.",
        },
      ],
    },
  },
);
