import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { toUserFacingError } from "@/lib/db/errors";
import { auditLogInsertStatement } from "@/lib/audit/write";
import { isValidIsoDate } from "@/lib/date";
import { shiftAssignments, staff, timeOffRequests } from "@/drizzle/schema";

/**
 * Core of requestTimeOff (lib/time-off/actions.ts), extracted the same way
 * as lib/shifts/assign.ts's setShiftAssignment so it can be exercised
 * directly in lib/db/scopedClient.isolation.d1.test.ts without a real
 * Next.js request context.
 *
 * Manager-entered "休み希望" (docs/plan.md's Phase 1b scope: admin proxy
 * entry only — the staff-submitted version waits for Phase 3's staff
 * login). Marked "acknowledged" rather than "requested" since there is no
 * separate acknowledgement step when the manager is the one entering it.
 *
 * A day can't be both a confirmed shift and a day off, so this clears any
 * existing shift_assignments row for the same staff+date — the mirror of
 * setShiftAssignment clearing any time-off request when a shift is set.
 */
export async function setTimeOffRequest(
  organizationId: string,
  staffId: string,
  date: string,
  actorUserId: string | null = null,
): Promise<{ error: string | null }> {
  if (!isValidIsoDate(date)) return { error: "日付が不正です" };

  const { db } = getScopedDb(organizationId);

  // staffId comes from the client — resolve it against this org first (D1
  // has no RLS; see lib/db/scopedClient.ts).
  const [staffRow] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.organizationId, organizationId), eq(staff.id, staffId)));
  if (!staffRow) return { error: "スタッフが見つかりません" };

  try {
    await db.batch([
      db
        .delete(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.organizationId, organizationId),
            eq(shiftAssignments.staffId, staffId),
            eq(shiftAssignments.date, date),
          ),
        ),
      db
        .insert(timeOffRequests)
        .values({ organizationId, staffId, date, status: "acknowledged" })
        .onConflictDoUpdate({
          target: [timeOffRequests.staffId, timeOffRequests.date],
          set: { status: "acknowledged" },
        }),
      auditLogInsertStatement(db, organizationId, actorUserId, "update", "shift_assignment", staffId, {
        date,
        timeOff: true,
      }),
    ]);
  } catch (err) {
    return { error: toUserFacingError(err, "保存に失敗しました") };
  }

  return { error: null };
}
