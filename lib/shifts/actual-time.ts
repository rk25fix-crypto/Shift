import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { toUserFacingError } from "@/lib/db/errors";
import { auditLogInsertStatement } from "@/lib/audit/write";
import { isValidIsoDate } from "@/lib/date";
import { shiftAssignments } from "@/drizzle/schema";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM", 00:00-23:59

/**
 * Records a staff member's actual clock-in/out for one day's confirmed
 * shift — called once at day's end (app/staff-home/page.tsx's
 * ActualTimeRecorder), by the staff member themselves
 * (lib/staff-auth/actions.ts's recordOwnActualShiftTime). The schedule
 * (shift_types.start_time/end_time) is a plan; this is what actually
 * happened, and lib/shifts/worked-shift.ts's resolveAssignmentTimes()
 * prefers it once set.
 *
 * Only ever updates an existing *confirmed* row for (organizationId,
 * staffId, date) — there is nothing to correct the actual time of if no
 * shift was ever confirmed for that day, and a draft isn't a real published
 * shift yet.
 */
export async function recordActualShiftTimeCore(
  organizationId: string,
  staffId: string,
  date: string,
  actualStartTime: string,
  actualEndTime: string,
  actorUserId: string | null = null,
): Promise<{ error: string | null }> {
  if (!isValidIsoDate(date)) return { error: "日付が不正です" };
  if (!TIME_PATTERN.test(actualStartTime) || !TIME_PATTERN.test(actualEndTime)) {
    return { error: "時刻の形式が正しくありません" };
  }

  const { db } = getScopedDb(organizationId);

  const [assignment] = await db
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.staffId, staffId),
        eq(shiftAssignments.date, date),
        eq(shiftAssignments.status, "confirmed"),
      ),
    );
  if (!assignment) return { error: "この日に確定したシフトが見つかりません" };

  try {
    await db.batch([
      db
        .update(shiftAssignments)
        .set({ actualStartTime, actualEndTime })
        .where(eq(shiftAssignments.id, assignment.id)),
      auditLogInsertStatement(db, organizationId, actorUserId, "update", "shift_assignment", staffId, {
        date,
        actualStartTime,
        actualEndTime,
      }),
    ]);
  } catch (err) {
    return { error: toUserFacingError(err, "保存に失敗しました") };
  }

  return { error: null };
}
