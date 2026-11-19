import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Academy runtime bundled for its vendored React version.
    "public/academy/assets/dc-runtime.js",
  ]),
]);

export default eslintConfig;
