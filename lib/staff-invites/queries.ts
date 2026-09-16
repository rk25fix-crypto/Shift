import { eq } from "drizzle-orm";
import { getRawDb } from "@/lib/db/raw";
import { staff, staffInvites } from "@/drizzle/schema";

export type InvitePreview =
  | { status: "valid"; staffName: string; organizationId: string }
  | { status: "claimed" | "expired" | "not_found" };

/**
 * Looks up an invite token for display on app/invite/[token]/page.tsx before
 * the visitor submits anything. organizationId isn't known until this query
 * resolves it from the token, so — like getCurrentMembership()
 * (lib/org/current.ts) — this has to use the raw D1 client rather than the
 * org-scoped one (allow-listed in eslint.config.mjs).
 */
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const db = getRawDb();
  const [invite] = await db
    .select({
      staffId: staffInvites.staffId,
      organizationId: staffInvites.organizationId,
      expiresAt: staffInvites.expiresAt,
      claimedAt: staffInvites.claimedAt,
    })
    .from(staffInvites)
    .where(eq(staffInvites.token, token));

  if (!invite) return { status: "not_found" };
  if (invite.claimedAt) return { status: "claimed" };
  if (invite.expiresAt.getTime() < Date.now()) return { status: "expired" };

  const [staffRow] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, invite.staffId));
  if (!staffRow) return { status: "not_found" };

  return { status: "valid", staffName: staffRow.name, organizationId: invite.organizationId };
}
