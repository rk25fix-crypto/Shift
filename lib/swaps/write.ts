import { and, eq } from "drizzle-orm";
import { getScopedDb, type ScopedDb } from "@/lib/db/scopedClient";
import { toUserFacingError } from "@/lib/db/errors";
import { auditLogInsertStatement } from "@/lib/audit/write";
import { isValidIsoDate } from "@/lib/date";
import { shiftAssignments, shiftTypes, staff, swapRequests, timeOffRequests } from "@/drizzle/schema";

export interface SwapRequestInput {
  date: string;
  fromStaffId: string;
  toStaffId: string;
  /** The shift fromStaffId currently works and wants to give up — null if fromStaffId has nothing that day (toStaffId is just covering). */
  fromShiftTypeId: string | null;
  /** The shift toStaffId currently works and wants to give up — null if this is a one-way cover, not a two-way trade. */
  toShiftTypeId: string | null;
}

const STALE_ERROR = "対象の確定済みシフトが見つかりません(申請後に変更された可能性があります)";

/**
 * True when staffId's confirmed schedule for `date` is exactly `shiftTypeId`
 * — or, when `shiftTypeId` is null, that staffId has nothing confirmed that
 * date at all. Used both when a swap request is created (so a manager finds
 * out immediately if what they typed doesn't match reality) and again right
 * before it's approved (the schedule may have moved on since). Checking the
 * *entire* day, not just whether the named shiftTypeId row exists, is what
 * stops the "null side" case from silently landing on top of some other
 * shift that staff member has since picked up.
 */
async function dayMatches(
  db: ScopedDb["db"],
  organizationId: string,
  staffId: string,
  date: string,
  shiftTypeId: string | null,
): Promise<boolean> {
  const rows = await db
    .select({ shiftTypeId: shiftAssignments.shiftTypeId })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.staffId, staffId),
        eq(shiftAssignments.date, date),
        eq(shiftAssignments.status, "confirmed"),
      ),
    );

  return shiftTypeId
    ? rows.length === 1 && rows[0].shiftTypeId === shiftTypeId
    : rows.length === 0;
}

/**
 * Core of requestSwap (lib/swaps/actions.ts), extracted the same way as
 * lib/shifts/assign.ts's setShiftAssignment for direct D1-isolation testing.
 *
 * Manager-entered, same as lib/time-off/set.ts's setTimeOffRequest — staff
 * self-service submission waits for Phase 3's staff login (docs/plan.md).
 * A manager records what a staff member asked for over the phone/in person;
 * this only creates the 'pending' record, it does not touch the schedule —
 * see decideSwapRequestCore for the actual swap.
 */
export async function createSwapRequestCore(
  organizationId: string,
  actorUserId: string | null,
  input: SwapRequestInput,
): Promise<{ error: string | null }> {
  const { date, fromStaffId, toStaffId, fromShiftTypeId, toShiftTypeId } = input;

  if (!isValidIsoDate(date)) return { error: "日付が不正です" };
  if (fromStaffId === toStaffId) return { error: "同じスタッフ同士は交代できません" };
  if (!fromShiftTypeId && !toShiftTypeId) {
    return { error: "交代する内容がありません。どちらか一方は選んでください" };
  }

  const { db } = getScopedDb(organizationId);

  // staffId/shiftTypeId come from the client — resolve every one of them
  // against this org first (D1 has no RLS; see lib/db/scopedClient.ts).
  const shiftTypeIdsToCheck = [fromShiftTypeId, toShiftTypeId].filter(
    (id): id is string => id !== null,
  );
  const [staffRows, shiftTypeRows] = await Promise.all([
    db.select({ id: staff.id }).from(staff).where(eq(staff.organizationId, organizationId)),
    shiftTypeIdsToCheck.length > 0
      ? db.select({ id: shiftTypes.id }).from(shiftTypes).where(eq(shiftTypes.organizationId, organizationId))
      : Promise.resolve([]),
  ]);
  const staffIds = new Set(staffRows.map((r) => r.id));
  const shiftTypeIds = new Set(shiftTypeRows.map((r) => r.id));
  if (!staffIds.has(fromStaffId) || !staffIds.has(toStaffId)) {
    return { error: "スタッフが見つかりません" };
  }
  if (shiftTypeIdsToCheck.some((id) => !shiftTypeIds.has(id))) {
    return { error: "シフト種別が見つかりません" };
  }

  // Catch a typo'd/misremembered shift right away rather than only at
  // approval time, when the error is harder to connect back to the cause.
  const [fromOk, toOk] = await Promise.all([
    dayMatches(db, organizationId, fromStaffId, date, fromShiftTypeId),
    dayMatches(db, organizationId, toStaffId, date, toShiftTypeId),
  ]);
  if (!fromOk || !toOk) {
    return { error: "入力内容が実際のシフトと一致しません。現在の割当を確認してください" };
  }

  try {
    await db.insert(swapRequests).values({
      organizationId,
      date,
      fromStaffId,
      toStaffId,
      fromShiftTypeId,
      toShiftTypeId,
      status: "pending",
      requestedBy: actorUserId,
    });
  } catch (err) {
    return { error: toUserFacingError(err, "申請の保存に失敗しました") };
  }

  return { error: null };
}

/**
 * Approves or rejects a pending swap request. Rejecting only updates the
 * request's status. Approving re-validates that BOTH staff members' entire
 * schedule for that date still matches exactly what the request named
 * (not just that the named shiftTypeId row still exists — a "null" side
 * must still be completely free, or the swap would double-book them with
 * whatever they've since picked up) before touching shift_assignments, then
 * performs the swap and the status update in one db.batch() so a manager
 * never ends up with half a swap applied.
 *
 * Known, accepted gap: the read above and the db.batch() below are two
 * separate round-trips, not one transaction — two managers deciding the
 * same request within that window (milliseconds) could both pass the
 * pending check and both run their batch. Given this app's real usage (a
 * small number of managers, deciding requests is not a high-frequency
 * action), closing this fully would mean making every statement in the
 * batch individually conditional on the request still being pending
 * (e.g. INSERT…SELECT…WHERE EXISTS), which is disproportionate complexity
 * for the risk — left as a documented limitation rather than "fixed" badly.
 */
export async function decideSwapRequestCore(
  organizationId: string,
  actorUserId: string | null,
  swapRequestId: string,
  decision: "approved" | "rejected",
): Promise<{ error: string | null }> {
  const { db } = getScopedDb(organizationId);

  const [request] = await db
    .select()
    .from(swapRequests)
    .where(
      and(
        eq(swapRequests.id, swapRequestId),
        eq(swapRequests.organizationId, organizationId),
        eq(swapRequests.status, "pending"),
      ),
    );
  if (!request) return { error: "対象の申請が見つからないか、既に処理済みです" };

  const decideRequest = db
    .update(swapRequests)
    .set({ status: decision, decidedBy: actorUserId, decidedAt: new Date() })
    .where(
      and(
        eq(swapRequests.id, swapRequestId),
        eq(swapRequests.organizationId, organizationId),
        eq(swapRequests.status, "pending"),
      ),
    );

  if (decision === "rejected") {
    try {
      await decideRequest;
    } catch (err) {
      return { error: toUserFacingError(err, "処理に失敗しました") };
    }
    return { error: null };
  }

  const { date, fromStaffId, toStaffId, fromShiftTypeId, toShiftTypeId } = request;

  const [fromOk, toOk] = await Promise.all([
    dayMatches(db, organizationId, fromStaffId, date, fromShiftTypeId),
    dayMatches(db, organizationId, toStaffId, date, toShiftTypeId),
  ]);
  if (!fromOk || !toOk) {
    return { error: STALE_ERROR };
  }

  // Both sides have just been confirmed to hold *exactly* what the request
  // named (nothing more, nothing else) — so clearing each staff member's
  // whole day before inserting the swapped result is safe and can't drop an
  // unrelated shift, while also guaranteeing no leftover row can double-book
  // them (the bug a narrower "delete only this shiftTypeId" delete had).
  // Declared as unknown[] and built up entirely via push(): an initial
  // array literal would lock TS's inferred element type to whichever
  // table's statement appears first, rejecting every later push() of a
  // different table's statement — this is reshaped into db.batch's actual
  // expected type at the call site below instead.
  const statements: unknown[] = [];
  statements.push(
    db
      .delete(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.organizationId, organizationId),
          eq(shiftAssignments.staffId, fromStaffId),
          eq(shiftAssignments.date, date),
        ),
      ),
    db
      .delete(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.organizationId, organizationId),
          eq(shiftAssignments.staffId, toStaffId),
          eq(shiftAssignments.date, date),
        ),
      ),
  );
  if (fromShiftTypeId) {
    // toStaffId takes over what fromStaffId gave up — clear any time-off
    // request of theirs for the same date, same as setShiftAssignment does.
    statements.push(
      db
        .delete(timeOffRequests)
        .where(
          and(
            eq(timeOffRequests.organizationId, organizationId),
            eq(timeOffRequests.staffId, toStaffId),
            eq(timeOffRequests.date, date),
          ),
        ),
      db.insert(shiftAssignments).values({
        organizationId,
        staffId: toStaffId,
        shiftTypeId: fromShiftTypeId,
        date,
        status: "confirmed",
        createdBy: actorUserId,
      }),
    );
  }
  if (toShiftTypeId) {
    statements.push(
      db
        .delete(timeOffRequests)
        .where(
          and(
            eq(timeOffRequests.organizationId, organizationId),
            eq(timeOffRequests.staffId, fromStaffId),
            eq(timeOffRequests.date, date),
          ),
        ),
      db.insert(shiftAssignments).values({
        organizationId,
        staffId: fromStaffId,
        shiftTypeId: toShiftTypeId,
        date,
        status: "confirmed",
        createdBy: actorUserId,
      }),
    );
  }
  statements.push(
    auditLogInsertStatement(db, organizationId, actorUserId, "update", "shift_assignment", null, {
      swapRequestId,
      date,
      fromStaffId,
      toStaffId,
      fromShiftTypeId,
      toShiftTypeId,
    }),
  );
  statements.push(decideRequest);

  try {
    // The array is built up conditionally via push(), so TS sees a plain
    // array rather than the non-empty tuple db.batch's type expects — it is
    // always non-empty in practice (the two per-staff clears are always
    // pushed first, decideRequest always pushed last).
    await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  } catch (err) {
    return {
      error: toUserFacingError(err, "交代の確定に失敗しました", {
        onUniqueConstraint: "交代先のスタッフには既にその日のシフトが入っています",
      }),
    };
  }

  return { error: null };
}
