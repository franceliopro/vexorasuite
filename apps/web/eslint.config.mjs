import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Lint gate for the web app. Rules of hooks are errors because a broken hook
 * order silently breaks a whole workspace; the remaining stylistic rules stay
 * off so the gate reports defects instead of formatting preferences.
 */
export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "artifacts/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-async-promise-executor": "off",
      "no-cond-assign": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-self-compare": "error",
      "no-constant-binary-expression": "error",
      "no-debugger": "error",
      "eqeqeq": ["error", "smart"],
    },
  },
);
