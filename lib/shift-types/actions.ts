"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getScopedDb } from "@/lib/db/scopedClient";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
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
  colorKey: string | null;
  sortOrder: number;
}

export async function createShiftType(
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

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
      colorKey: input.colorKey,
      sortOrder: input.sortOrder,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "保存に失敗しました" };
  }

  revalidatePath("/settings/shift-types");
  return { error: null };
}

export async function updateShiftType(
  shiftTypeId: string,
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

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
        colorKey: input.colorKey,
        sortOrder: input.sortOrder,
      })
      .where(and(eq(shiftTypes.id, shiftTypeId), eq(shiftTypes.organizationId, organizationId)));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "保存に失敗しました" };
  }

  revalidatePath("/settings/shift-types");
  return { error: null };
}

export async function deleteShiftType(shiftTypeId: string): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const { db } = getScopedDb(organizationId);

  try {
    await db
      .delete(shiftTypes)
      .where(and(eq(shiftTypes.id, shiftTypeId), eq(shiftTypes.organizationId, organizationId)));
  } catch (err) {
    // shift_assignments references shift_types with ON DELETE RESTRICT, so a
    // shift type still in use surfaces as a foreign-key violation here rather
    // than silently orphaning schedule data.
    const message = err instanceof Error ? err.message : "";
    return {
      error: /FOREIGN KEY|SQLITE_CONSTRAINT/i.test(message)
        ? "このシフト種別は使用中のため削除できません"
        : message || "削除に失敗しました",
    };
  }

  revalidatePath("/settings/shift-types");
  return { error: null };
}
