import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Standalone CommonJS scripts — the project isn't `"type": "module"`, so
  // .js files run under Node's CJS loader and legitimately need require().
  {
    files: ["migrate-runner.js", "scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Native build artifacts — Xcode's DerivedData and Gradle output are
    // gitignored but ESLint would otherwise scan them and complain about
    // vendored JS inside Capacitor.framework bundles.
    "ios/**",
    "android/**",
    "mobile/**",
    // Archived SAP BTP setup — not shipped, not maintained.
    "legacy/**",
    // Coverage output and Claude Code local state.
    "coverage/**",
    ".claude/**",
    // Never lint dependencies.
    "node_modules/**",
  ]),
]);

export default eslintConfig;
