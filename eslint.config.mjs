import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // SPEC.md section 14, non-negotiable #1: agent code never imports the
  // signer and never reads *_SECRET_KEY env vars. The signer is the only
  // place allowed to touch the treasury/vendor/attacker secret keys.
  {
    files: ["src/lib/agent/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/solana/signer", "**/solana/signer*", "*/signer"],
              message:
                "Agent code must never import the signer (SPEC.md section 14, #1). Call src/lib/pipeline instead.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/_SECRET_KEY$/]",
          message:
            "Agent code must never read *_SECRET_KEY env vars (SPEC.md section 14, #1).",
        },
      ],
    },
  },
]);

export default eslintConfig;
