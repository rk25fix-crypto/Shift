"use server";

import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import {
  createShiftTypeCore,
  deleteShiftTypeCore,
  updateShiftTypeCore,
  type ShiftTypeInput,
} from "@/lib/shift-types/write";

export type { ShiftTypeInput };

export async function createShiftType(
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await createShiftTypeCore(organizationId, input);
  if (!result.error) revalidatePath("/settings/shift-types");
  return result;
}

export async function updateShiftType(
  shiftTypeId: string,
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await updateShiftTypeCore(organizationId, shiftTypeId, input);
  if (!result.error) revalidatePath("/settings/shift-types");
  return result;
}

export async function deleteShiftType(shiftTypeId: string): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await deleteShiftTypeCore(organizationId, shiftTypeId);
  if (!result.error) revalidatePath("/settings/shift-types");
  return result;
}
