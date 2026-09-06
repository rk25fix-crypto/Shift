import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
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
  // only backstop.
  const [staffRow] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.organizationId, organizationId), eq(staff.id, staffId)));
  if (!staffRow) return { error: "スタッフが見つかりません" };

  if (shiftTypeId) {
    const [shiftTypeRow] = await db
      .select({ id: shiftTypes.id })
      .from(shiftTypes)
      .where(and(eq(shiftTypes.organizationId, organizationId), eq(shiftTypes.id, shiftTypeId)));
    if (!shiftTypeRow) return { error: "シフト種別が見つかりません" };
  }

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
      .delete(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.organizationId, organizationId),
          eq(timeOffRequests.staffId, staffId),
          eq(timeOffRequests.date, date),
        ),
      ),
  ]);

  if (shiftTypeId) {
    try {
      await db.insert(shiftAssignments).values({
        organizationId,
        staffId,
        shiftTypeId,
        date,
        status: "confirmed",
        createdBy: actorUserId,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "保存に失敗しました" };
    }
  }

  return { error: null };
}
