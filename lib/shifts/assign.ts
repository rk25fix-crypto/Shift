import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { toUserFacingError } from "@/lib/db/errors";
import { auditLogInsertStatement } from "@/lib/audit/write";
import { isValidIsoDate } from "@/lib/date";
import { shiftAssignments, shiftTypes, staff, timeOffRequests } from "@/drizzle/schema";

/**
 * Core of assignShift (lib/shifts/actions.ts), extracted so it can be
 * exercised directly in lib/db/scopedClient.isolation.d1.test.ts without
 * needing a real Next.js request context — the wrapping server action needs
 * next/headers (for the session) purely to attribute createdBy, which this
 * function takes as a plain argument instead.
 *
 * Sets (or clears, when shiftTypeId is null) the one shift a staff member
 * holds on a given date. The schema allows more than one shift per day
 * (shift_assignments' unique key includes shift_type_id — see
 * docs/plan.md), but the Today/Week views keep to "tap a chip, pick one
 * shift" for Phase 1a/1b, matching lib/shift-generator's one-shift-a-day
 * model. A manager who genuinely needs a second shift that day can add it
 * once the data model's multi-shift support gets a UI.
 *
 * A day can't be both a scheduled shift and a requested day off, so this
 * also clears any lib/time-off/set.ts time-off request for the same
 * staff+date (the mirror of setTimeOffRequest clearing any shift there).
 */
export async function setShiftAssignment(
  organizationId: string,
  actorUserId: string | null,
  staffId: string,
  date: string,
  shiftTypeId: string | null,
): Promise<{ error: string | null }> {
  if (!isValidIsoDate(date)) return { error: "日付が不正です" };

  const { db } = getScopedDb(organizationId);

  // staffId/shiftTypeId come from the client — without this, an org's own
  // manager could pass another org's staffId/shiftTypeId and create a
  // cross-tenant row (D1 has no RLS to catch it; see
  // lib/db/scopedClient.ts). Resolving both against this org first is the
  // only backstop. Run in parallel (not one-then-the-other) — this is the
  // hot path for the most-tapped interaction in the app, so every avoidable
  // round-trip here is felt directly as UI lag.
  const [[staffRow], shiftTypeRows] = await Promise.all([
    db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.organizationId, organizationId), eq(staff.id, staffId))),
    shiftTypeId
      ? db
          .select({ id: shiftTypes.id })
          .from(shiftTypes)
          .where(and(eq(shiftTypes.organizationId, organizationId), eq(shiftTypes.id, shiftTypeId)))
      : Promise.resolve([]),
  ]);
  if (!staffRow) return { error: "スタッフが見つかりません" };
  if (shiftTypeId && !shiftTypeRows[0]) return { error: "シフト種別が見つかりません" };

  const clearAssignment = db
    .delete(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.staffId, staffId),
        eq(shiftAssignments.date, date),
      ),
    );
  const clearTimeOff = db
    .delete(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.organizationId, organizationId),
        eq(timeOffRequests.staffId, staffId),
        eq(timeOffRequests.date, date),
      ),
    );

  try {
    if (shiftTypeId) {
      // One round-trip instead of two: the clear-then-insert used to be a
      // separate batch() call followed by a separate insert() — D1's
      // batch() runs a whole array atomically in one request, so folding
      // the insert into the same batch as the deletes is both fewer
      // round-trips and (as a bonus) removes the brief window where the
      // old code had already cleared the cell but not yet written the new
      // shift.
      await db.batch([
        clearAssignment,
        clearTimeOff,
        db.insert(shiftAssignments).values({
          organizationId,
          staffId,
          shiftTypeId,
          date,
          status: "confirmed",
          createdBy: actorUserId,
        }),
        auditLogInsertStatement(db, organizationId, actorUserId, "update", "shift_assignment", staffId, {
          date,
          shiftTypeId,
        }),
      ]);
    } else {
      await db.batch([
        clearAssignment,
        clearTimeOff,
        auditLogInsertStatement(db, organizationId, actorUserId, "update", "shift_assignment", staffId, {
          date,
          shiftTypeId: null,
        }),
      ]);
    }
  } catch (err) {
    return { error: toUserFacingError(err, "保存に失敗しました") };
  }

  return { error: null };
}
