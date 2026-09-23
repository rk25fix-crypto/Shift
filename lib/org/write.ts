import { eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { toUserFacingError } from "@/lib/db/errors";
import { organizations } from "@/drizzle/schema";

/**
 * Soft-deletes an organization: sets `deletedAt`, nothing else. Rows in
 * every other table (staff, shift_assignments, etc.) are left alone —
 * lib/org/current.ts's getCurrentMembership()/listMembershipsForCurrentUser()
 * filtering out orgs with a deletedAt is what actually makes a deleted org
 * disappear from the app for its members. Authorization (owner-only) is the
 * caller's job (lib/org/actions.ts's deleteOrganization), same split as
 * every other *Core function in this codebase.
 */
export async function deleteOrganizationCore(organizationId: string): Promise<{ error: string | null }> {
  const { db } = getScopedDb(organizationId);
  try {
    await db.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, organizationId));
  } catch (err) {
    return { error: toUserFacingError(err, "削除に失敗しました") };
  }
  return { error: null };
}
