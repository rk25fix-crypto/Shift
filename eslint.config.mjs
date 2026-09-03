import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // D1 has no Row-Level Security, so tenant isolation depends entirely
      // on every query going through the org-scoped client. The raw client
      // touches the D1 binding directly with no org_id applied, so its use
      // is restricted to the allow-list below (lib/db/scopedClient.ts,
      // Better Auth's own tables, Stripe webhook, admin jobs).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/raw",
              message:
                "raw D1 client has no tenant scoping — only lib/db/scopedClient.ts, lib/auth/config.ts, the Stripe webhook handler, and lib/admin/** batch jobs may import it.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "lib/db/scopedClient.ts",
      "lib/auth/config.ts",
      "lib/auth/actions.ts",
      "lib/org/current.ts",
      "lib/db/scopedClient.isolation.d1.test.ts",
      "app/api/stripe/webhook/route.ts",
      "lib/admin/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // vinext/Cloudflare build outputs
    ".vinext/**",
    ".wrangler/**",
    "dist/**",
    "worker-configuration.d.ts",
  ]),
]);

export default eslintConfig;
