"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { auth } from "@/lib/auth/config";
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

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await createShiftTypeCore(organizationId, input, session?.user.id ?? null);
  if (!result.error) revalidatePath("/settings/shift-types");
  return result;
}

export async function updateShiftType(
  shiftTypeId: string,
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await updateShiftTypeCore(
    organizationId,
    shiftTypeId,
    input,
    session?.user.id ?? null,
  );
  if (!result.error) revalidatePath("/settings/shift-types");
  return result;
}

export async function deleteShiftType(shiftTypeId: string): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await deleteShiftTypeCore(organizationId, shiftTypeId, session?.user.id ?? null);
  if (!result.error) revalidatePath("/settings/shift-types");
  return result;
}
