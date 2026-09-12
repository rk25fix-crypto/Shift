import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { getRawDb } from "@/lib/db/raw";
import { memberships, organizations } from "@/drizzle/schema";
import { pickCurrentMembership } from "@/lib/org/pick-membership";

export type MembershipRole = "owner" | "admin" | "staff";

export interface CurrentMembership {
  organizationId: string;
  role: MembershipRole;
}

export interface OrgMembershipOption {
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
}

/** Which of the user's orgs to treat as "current" — set by lib/org/actions.ts's switchOrganization(). */
export const CURRENT_ORG_COOKIE = "shift_current_org";

/**
 * Resolves the logged-in user's current organization + role. A user can
 * belong to more than one organization (docs/plan.md, "1ユーザーが複数事業
 * 所を持つケース") — which one is "current" follows the CURRENT_ORG_COOKIE
 * set by the org switcher (components/settings/OrgSwitcher.tsx), falling
 * back to the first membership when there's no cookie or it names an org
 * this user isn't (or is no longer) a member of.
 *
 * Queries `memberships` directly via the raw D1 client (allow-listed in
 * eslint.config.mjs) because resolving organizationId is the one thing this
 * function must do before any org-scoped access is possible.
 */
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const db = getRawDb();
  const rows = await db
    .select({ organizationId: memberships.organizationId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .orderBy(memberships.createdAt);

  const preferredOrgId = (await cookies()).get(CURRENT_ORG_COOKIE)?.value;
  return pickCurrentMembership(rows, preferredOrgId);
}

/** Every organization the logged-in user belongs to, for the org switcher — see components/settings/OrgSwitcher.tsx. */
export async function listMembershipsForCurrentUser(): Promise<OrgMembershipOption[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const db = getRawDb();
  return db
    .select({
      organizationId: memberships.organizationId,
      organizationName: organizations.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(memberships.createdAt);
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
