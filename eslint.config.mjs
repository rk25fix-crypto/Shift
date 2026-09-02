import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // RLS only holds if server code always goes through the user-scoped
      // client. The service-role client bypasses RLS entirely, so its use
      // is restricted to the allow-list below (Stripe webhook, admin jobs).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/service",
              message:
                "service-role client bypasses RLS — only the Stripe webhook handler and lib/admin/** batch jobs may import it.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/api/stripe/webhook/route.ts", "lib/admin/**/*.ts"],
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
  ]),
]);

export default eslintConfig;
