"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { auth } from "@/lib/auth/config";
import { setShiftAssignment } from "@/lib/shifts/assign";

/** Server Action wrapper around setShiftAssignment() — see lib/shifts/assign.ts for the actual logic. */
export async function assignShift(
  staffId: string,
  date: string,
  shiftTypeId: string | null,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await setShiftAssignment(
    organizationId,
    session?.user.id ?? null,
    staffId,
    date,
    shiftTypeId,
  );

  if (!result.error) {
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath(`/staff/${staffId}`);
  }

  return result;
}
