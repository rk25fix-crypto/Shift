import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { errorChainMatches, logError, toUserFacingError } from "@/lib/db/errors";
import { shiftTypes } from "@/drizzle/schema";

export interface ShiftTypeInput {
  code: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  crossesMidnight: boolean;
  breakMinutes: number;
  isRequired: boolean;
  isBalanced: boolean;
  requiredCount: number;
  colorKey: string | null;
  sortOrder: number;
}

/**
 * Core of createShiftType/updateShiftType/deleteShiftType
 * (lib/shift-types/actions.ts), extracted so they can be exercised directly
 * in lib/db/scopedClient.isolation.d1.test.ts without a real Next.js
 * request context — same split as lib/shifts/assign.ts's setShiftAssignment.
 */
export async function createShiftTypeCore(
  organizationId: string,
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  if (!Number.isInteger(input.requiredCount) || input.requiredCount < 1) {
    return { error: "必要人数は1人以上の整数にしてください" };
  }

  const { db } = getScopedDb(organizationId);

  try {
    await db.insert(shiftTypes).values({
      organizationId,
      code: input.code,
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      crossesMidnight: input.crossesMidnight,
      breakMinutes: input.breakMinutes,
      isRequired: input.isRequired,
      isBalanced: input.isBalanced,
      requiredCount: input.requiredCount,
      colorKey: input.colorKey,
      sortOrder: input.sortOrder,
    });
  } catch (err) {
    return {
      error: toUserFacingError(err, "保存に失敗しました", {
        onUniqueConstraint: "このコードは既に使われています",
      }),
    };
  }

  return { error: null };
}

export async function updateShiftTypeCore(
  organizationId: string,
  shiftTypeId: string,
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  if (!Number.isInteger(input.requiredCount) || input.requiredCount < 1) {
    return { error: "必要人数は1人以上の整数にしてください" };
  }

  const { db } = getScopedDb(organizationId);

  try {
    await db
      .update(shiftTypes)
      .set({
        code: input.code,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        crossesMidnight: input.crossesMidnight,
        breakMinutes: input.breakMinutes,
        isRequired: input.isRequired,
        isBalanced: input.isBalanced,
        requiredCount: input.requiredCount,
        colorKey: input.colorKey,
        sortOrder: input.sortOrder,
      })
      .where(and(eq(shiftTypes.id, shiftTypeId), eq(shiftTypes.organizationId, organizationId)));
  } catch (err) {
    return {
      error: toUserFacingError(err, "保存に失敗しました", {
        onUniqueConstraint: "このコードは既に使われています",
      }),
    };
  }

  return { error: null };
}

export async function deleteShiftTypeCore(
  organizationId: string,
  shiftTypeId: string,
): Promise<{ error: string | null }> {
  const { db } = getScopedDb(organizationId);

  try {
    await db
      .delete(shiftTypes)
      .where(and(eq(shiftTypes.id, shiftTypeId), eq(shiftTypes.organizationId, organizationId)));
  } catch (err) {
    // shift_assignments references shift_types with ON DELETE RESTRICT, so a
    // shift type still in use surfaces as a foreign-key violation here rather
    // than silently orphaning schedule data. The real SQLite reason is
    // nested under err.cause, not err.message (see lib/db/errors.ts), so the
    // check has to walk the whole chain.
    if (errorChainMatches(err, /FOREIGN KEY|SQLITE_CONSTRAINT/i)) {
      logError(err);
      return { error: "このシフト種別は使用中のため削除できません" };
    }
    return { error: toUserFacingError(err, "削除に失敗しました") };
  }

  return { error: null };
}
