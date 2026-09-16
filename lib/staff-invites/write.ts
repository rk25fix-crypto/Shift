import { and, eq, isNull } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { getRawDb } from "@/lib/db/raw";
import { toUserFacingError } from "@/lib/db/errors";
import { staff, staffInvites, staffSessions } from "@/drizzle/schema";
import type { StaffInput } from "@/lib/staff/write";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 未使用リンクは7日で失効(design_handoff_shift_bright_flow/README.md)
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // クレーム後のセッションは30日

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

/**
 * Issues a fresh one-time invite link for a staff member — called from the
 * admin-side staff detail page. Each call replaces any still-unclaimed
 * invite for this staffId (old links stop working the moment a new one is
 * issued) rather than accumulating live tokens.
 */
export async function createInviteCore(
  organizationId: string,
  staffId: string,
): Promise<{ token: string; error: null } | { token: null; error: string }> {
  const { db } = getScopedDb(organizationId);

  const [staffRow] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.organizationId, organizationId)));
  if (!staffRow) return { token: null, error: "スタッフが見つかりません" };

  const token = generateToken();
  try {
    await db.batch([
      // Old unclaimed link stops working the moment a new one is issued.
      db
        .delete(staffInvites)
        .where(
          and(
            eq(staffInvites.organizationId, organizationId),
            eq(staffInvites.staffId, staffId),
            isNull(staffInvites.claimedAt),
          ),
        ),
      // Re-issuing also revokes any session from a previous claim — the
      // admin action a manager reaches for when the wrong person claimed a
      // link (or a device was lost) is "issue a new link," so that has to
      // actually end the old session, not just start a new one alongside it.
      db.delete(staffSessions).where(
        and(eq(staffSessions.organizationId, organizationId), eq(staffSessions.staffId, staffId)),
      ),
      db.insert(staffInvites).values({
        organizationId,
        staffId,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      }),
    ]);
  } catch (err) {
    return { token: null, error: toUserFacingError(err, "招待リンクの発行に失敗しました") };
  }

  return { token, error: null };
}

export interface ClaimedStaffSession {
  organizationId: string;
  staffId: string;
  sessionToken: string;
}

/**
 * Validates an invite token and, if still live, marks it claimed and issues
 * a staffSessions row in the same write — a claimed invite token is never
 * itself reused as a session credential, so a bookmarked/leaked invite link
 * stops working the moment it's been claimed once.
 *
 * Uses the raw D1 client (no organizationId is known from the token alone
 * until after this lookup) — allow-listed in eslint.config.mjs alongside the
 * other legitimate no-org-scope-yet bootstrap paths.
 */
export async function claimInviteCore(
  token: string,
  input: Pick<StaffInput, "fixedDaysOff" | "unavailableShiftTypeIds">,
): Promise<ClaimedStaffSession | { error: string }> {
  const db = getRawDb();

  const [invite] = await db.select().from(staffInvites).where(eq(staffInvites.token, token));
  if (!invite) return { error: "招待リンクが見つかりません" };
  if (invite.claimedAt) return { error: "この招待リンクはすでに使用されています" };
  if (invite.expiresAt.getTime() < Date.now()) return { error: "この招待リンクは期限切れです" };

  // Claiming the invite is its own write, gated by isNull(claimedAt) and
  // checked for a returned row, before anything else touches the DB — two
  // concurrent claims of the same token (a double-tap, two tabs) must not
  // both succeed and hand out two sessions for one invite.
  let claimed;
  try {
    [claimed] = await db
      .update(staffInvites)
      .set({ claimedAt: new Date() })
      .where(and(eq(staffInvites.id, invite.id), isNull(staffInvites.claimedAt)))
      .returning({ id: staffInvites.id });
  } catch (err) {
    return { error: toUserFacingError(err, "招待の受け付けに失敗しました") };
  }
  if (!claimed) return { error: "この招待リンクはすでに使用されています" };

  const sessionToken = generateToken();
  try {
    await db.batch([
      db
        .update(staff)
        .set({
          fixedDaysOff: input.fixedDaysOff,
          unavailableShiftTypeIds: input.unavailableShiftTypeIds,
        })
        .where(and(eq(staff.id, invite.staffId), eq(staff.organizationId, invite.organizationId))),
      db.insert(staffSessions).values({
        organizationId: invite.organizationId,
        staffId: invite.staffId,
        token: sessionToken,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      }),
    ]);
  } catch (err) {
    return { error: toUserFacingError(err, "招待の受け付けに失敗しました") };
  }

  return { organizationId: invite.organizationId, staffId: invite.staffId, sessionToken };
}
