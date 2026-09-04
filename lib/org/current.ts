import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { getRawDb } from "@/lib/db/raw";
import { memberships } from "@/drizzle/schema";

export type MembershipRole = "owner" | "admin" | "staff";

export interface CurrentMembership {
  organizationId: string;
  role: MembershipRole;
}

/**
 * Resolves the logged-in user's organization + role. A user can belong to
 * more than one organization (docs/plan.md, "1ユーザーが複数事業所を持つ
 * ケース"), but the org switcher is Phase 3 — until then every page/action
 * uses the first membership found, via this single shared lookup.
 *
 * Queries `memberships` directly via the raw D1 client (allow-listed in
 * eslint.config.mjs) because resolving organizationId is the one thing this
 * function must do before any org-scoped access is possible.
 */
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const db = getRawDb();
  const [row] = await db
    .select({ organizationId: memberships.organizationId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  return row ?? null;
}

/** Same as getCurrentMembership(), but throws for pages/actions that require an org context to render at all. */
export async function requireCurrentMembership(): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new Error("この操作には事業所への所属が必要です。");
  }
  return membership;
}

export function isManager(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}
