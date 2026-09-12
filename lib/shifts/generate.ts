import { and, eq, gte, lt } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { toUserFacingError } from "@/lib/db/errors";
import { isValidIsoDate, datesInRange, monthOf } from "@/lib/date";
import { generateShifts, type UnfilledShift } from "@/lib/shift-generator";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import { listTimeOffForRange } from "@/lib/time-off/queries";
import { shiftAssignments } from "@/drizzle/schema";

// D1 caps bound parameters per statement at 100 (confirmed empirically —
// 100 succeeds, 101 fails with "too many SQL variables"). drizzle binds 6
// params per row here: organizationId, staffId, shiftTypeId, date, status,
// and id (id's $defaultFn generates the value in JS and binds it — it is
// NOT inlined as a literal). Only createdBy (null) and updatedAt (a SQL
// default) are actually inlined. 12 rows * 6 params = 72, safely under 100.
const INSERT_CHUNK_SIZE = 12;

export interface GenerateDraftResult {
  error: string | null;
  draftCount?: number;
  unfilledShifts?: UnfilledShift[];
}

/**
 * Core of generateDraftShifts (lib/shifts/generate-actions.ts), extracted
 * the same way as lib/shifts/assign.ts's setShiftAssignment for direct
 * testing. Replaces whatever drafts already exist in the range with a
 * fresh run from lib/shift-generator, seeded from this month's confirmed
 * assignments before `startDate` so generating one week at a time doesn't
 * reset workload fairness — see docs/plan.md's auto-generate design notes.
 *
 * Never touches confirmed rows: a manager who has already tapped a cell to
 * confirm it (via setShiftAssignment) keeps that choice across regenerations
 * — only untouched drafts get replaced.
 */
export async function generateDraftShifts(
  organizationId: string,
  startDate: string,
  endDateExclusive: string,
): Promise<GenerateDraftResult> {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDateExclusive) || startDate >= endDateExclusive) {
    return { error: "日付が不正です" };
  }

  const [staffList, shiftTypeList, confirmedInRange, timeOff] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    getAssignmentsForOrgRange(organizationId, startDate, endDateExclusive),
    listTimeOffForRange(organizationId, startDate, endDateExclusive),
  ]);

  const requiredTypes = shiftTypeList.filter((t) => t.isRequired);
  if (requiredTypes.length === 0) {
    return {
      error:
        "必須のシフト種別が設定されていません。設定 > シフト種別 で「毎日必須のシフト」を1つ以上有効にしてください。",
    };
  }

  const month = monthOf(startDate);
  const monthConfirmedBeforeStart = await getAssignmentsForOrgRange(
    organizationId,
    `${month}-01`,
    startDate,
  );
  const initialAssignmentCounts: Record<string, number> = {};
  // Both this month's confirmed shifts before the window, and any already
  // confirmed inside it (e.g. a manager hand-confirmed a few cells before
  // regenerating the rest) — a staff member with confirmed shifts either
  // way should be weighted as having worked them, not treated as idle.
  for (const a of [...monthConfirmedBeforeStart, ...confirmedInRange]) {
    initialAssignmentCounts[a.staffId] = (initialAssignmentCounts[a.staffId] ?? 0) + 1;
  }
  const result = generateShifts({
    staff: staffList.map((s) => ({
      id: s.id,
      fixedDaysOff: s.fixedDaysOff,
      unavailableShiftTypeIds: s.unavailableShiftTypeIds,
    })),
    shiftTypes: requiredTypes.map((t) => ({
      id: t.id,
      isRequired: t.isRequired,
      isBalanced: t.isBalanced,
      requiredCount: t.requiredCount,
    })),
    dates: datesInRange(startDate, endDateExclusive),
    timeOffRequests: timeOff,
    existingAssignments: confirmedInRange,
    initialAssignmentCounts,
  });

  const { db } = getScopedDb(organizationId);
  const deleteExistingDrafts = db
    .delete(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.status, "draft"),
        gte(shiftAssignments.date, startDate),
        lt(shiftAssignments.date, endDateExclusive),
      ),
    );

  try {
    if (result.draftAssignments.length === 0) {
      await deleteExistingDrafts;
    } else {
      const chunks: (typeof result.draftAssignments)[] = [];
      for (let i = 0; i < result.draftAssignments.length; i += INSERT_CHUNK_SIZE) {
        chunks.push(result.draftAssignments.slice(i, i + INSERT_CHUNK_SIZE));
      }
      await db.batch([
        deleteExistingDrafts,
        ...chunks.map((chunk) =>
          db.insert(shiftAssignments).values(
            chunk.map((a) => ({
              organizationId,
              staffId: a.staffId,
              shiftTypeId: a.shiftTypeId,
              date: a.date,
              status: "draft" as const,
            })),
          ),
        ),
      ]);
    }
  } catch (err) {
    return { error: toUserFacingError(err, "生成に失敗しました") };
  }

  return {
    error: null,
    draftCount: result.draftAssignments.length,
    unfilledShifts: result.unfilledShifts,
  };
}

/** Publishes every draft in `[startDate, endDateExclusive)` as confirmed. */
export async function confirmDraftShifts(
  organizationId: string,
  startDate: string,
  endDateExclusive: string,
): Promise<{ error: string | null }> {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDateExclusive)) {
    return { error: "日付が不正です" };
  }

  const { db } = getScopedDb(organizationId);

  try {
    await db
      .update(shiftAssignments)
      .set({ status: "confirmed" })
      .where(
        and(
          eq(shiftAssignments.organizationId, organizationId),
          eq(shiftAssignments.status, "draft"),
          gte(shiftAssignments.date, startDate),
          lt(shiftAssignments.date, endDateExclusive),
        ),
      );
  } catch (err) {
    return { error: toUserFacingError(err, "確定に失敗しました") };
  }

  return { error: null };
}

/** Deletes every draft in `[startDate, endDateExclusive)` without confirming it. */
export async function discardDraftShifts(
  organizationId: string,
  startDate: string,
  endDateExclusive: string,
): Promise<{ error: string | null }> {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDateExclusive)) {
    return { error: "日付が不正です" };
  }

  const { db } = getScopedDb(organizationId);

  try {
    await db
      .delete(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.organizationId, organizationId),
          eq(shiftAssignments.status, "draft"),
          gte(shiftAssignments.date, startDate),
          lt(shiftAssignments.date, endDateExclusive),
        ),
      );
  } catch (err) {
    return { error: toUserFacingError(err, "破棄に失敗しました") };
  }

  return { error: null };
}
