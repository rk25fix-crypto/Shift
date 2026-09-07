"use server";

import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { createStaffCore, deactivateStaffCore, updateStaffCore, type StaffInput } from "@/lib/staff/write";

export type { StaffInput };

export async function createStaff(input: StaffInput): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await createStaffCore(organizationId, role, input);
  if (!result.error) revalidatePath("/staff");
  return result;
}

export async function updateStaff(
  staffId: string,
  input: StaffInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await updateStaffCore(organizationId, role, staffId, input);
  if (!result.error) {
    revalidatePath("/staff");
    revalidatePath(`/staff/${staffId}`);
  }
  return result;
}

export async function deactivateStaff(staffId: string): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await deactivateStaffCore(organizationId, staffId);
  if (!result.error) revalidatePath("/staff");
  return result;
}
