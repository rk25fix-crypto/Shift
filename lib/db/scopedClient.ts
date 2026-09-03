import { getRawDb, type RawDb } from "@/lib/db/raw";

/**
 * The only way to get a database handle outside lib/db/raw.ts (enforced by
 * eslint.config.mjs). Getting one requires an organizationId up front, but
 * that alone does not filter every query for you — D1 has no Row-Level
 * Security, so every query built from `.db` must still explicitly filter by
 * `.organizationId`. The real backstop against a missed filter is
 * lib/db/scopedClient.isolation.test.ts — see docs/plan.md
 * "テナント分離モデル(D1版)".
 */
export interface ScopedDb {
  db: RawDb;
  organizationId: string;
}

/** Wraps an already-constructed RawDb — used by getScopedDb() in production and directly by tests with a local SQLite-backed RawDb. */
export function scopeDb(db: RawDb, organizationId: string): ScopedDb {
  return { db, organizationId };
}

export function getScopedDb(organizationId: string): ScopedDb {
  return scopeDb(getRawDb(), organizationId);
}
