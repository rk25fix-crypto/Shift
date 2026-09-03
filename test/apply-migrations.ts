import { applyD1Migrations, env } from "cloudflare:test";

// Runs once before the D1-backed test suite (vitest.d1.config.ts) so every
// test file sees a freshly-migrated schema in the Miniflare-backed DB
// binding, matching what `wrangler d1 migrations apply shift-db` does
// against real D1.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
