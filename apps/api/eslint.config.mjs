import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Lint gate for the API. The goal is catching real defects (unreachable code,
 * duplicated keys, unsafe finally, comparisons, stray debugger) without fighting
 * the intentional dynamism of NestJS/Prisma DTOs. Type safety is enforced by
 * `tsc --noEmit` in the same pipeline.
 */
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    rules: {
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
  {
    files: ["**/*.spec.ts"],
    languageOptions: { globals: { ...globals.jest } },
  },
);
