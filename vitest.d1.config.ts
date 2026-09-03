import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import path from "node:path";

/**
 * Separate config for D1-backed tests (the tenant-isolation suite — see
 * lib/db/scopedClient.isolation.d1.test.ts). Runs inside a real Miniflare
 * Workers runtime with a genuine local D1 binding, unlike vitest.config.ts's
 * jsdom pool, which cannot resolve `cloudflare:workers` at all. Run via
 * `npm run test:d1`.
 *
 * Deliberately does not load wrangler.jsonc's `main` (the built app worker,
 * which only exists after `vinext build`) — this only needs the `DB`
 * binding, declared directly below.
 */
export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, "drizzle/migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    test: {
      include: ["**/*.d1.test.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
    },
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: "2026-08-22",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "shift-db-test" },
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  };
});
