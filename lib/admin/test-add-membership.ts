import { getRawDb } from "@/lib/db/raw";
import { organizations, memberships } from "@/drizzle/schema";

/**
 * E2E-only: adds a new organization + owner membership for an already
 * logged-in test user — see app/api/test/add-membership/route.ts, the only
 * caller. Lives under lib/admin/ (allow-listed for raw D1 access in
 * eslint.config.mjs) rather than directly in the route handler so the route
 * itself doesn't need its own ESLint carve-out.
 */
export async function addMembershipForUser(userId: string, organizationName: string): Promise<string> {
  const db = getRawDb();
  const [org] = await db.insert(organizations).values({ name: organizationName }).returning();
  await db.insert(memberships).values({
    organizationId: org.id,
    userId,
    role: "owner",
  });
  return org.id;
}
