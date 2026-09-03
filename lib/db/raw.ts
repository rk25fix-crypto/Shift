import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/drizzle/schema";
import * as authSchema from "@/drizzle/auth-schema";

/**
 * The raw D1-backed Drizzle client, with no tenant scoping applied.
 *
 * This is the ONLY module allowed to touch the D1 binding directly —
 * restricted by eslint.config.mjs's no-restricted-imports (mirrors the
 * service-role restriction from the Supabase version of this app). Every
 * other module must go through lib/db/scopedClient.ts, which forces every
 * query to carry an organization_id. D1 has no Row-Level Security, so this
 * import boundary is the only thing standing between a missed org_id filter
 * and a cross-tenant data leak — see docs/plan.md "テナント分離モデル(D1版)".
 */
export function getRawDb() {
  return drizzle(env.DB, { schema: { ...schema, ...authSchema } });
}

export type RawDb = ReturnType<typeof getRawDb>;
