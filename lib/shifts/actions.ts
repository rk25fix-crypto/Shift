"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { auth } from "@/lib/auth/config";
import { setShiftAssignment } from "@/lib/shifts/assign";
import { recordActualShiftTimeCore } from "@/lib/shifts/actual-time";

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

/**
 * Manager correcting a staff member's actual clock-in/out for a past or
 * present day — same core as lib/staff-auth/actions.ts's
 * recordOwnActualShiftTime, but staffId is manager-supplied (not
 * session-derived) since this edits someone else's record.
 */
export async function recordActualShiftTimeAsManager(
  staffId: string,
  date: string,
  actualStartTime: string,
  actualEndTime: string,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await recordActualShiftTimeCore(
    organizationId,
    staffId,
    date,
    actualStartTime,
    actualEndTime,
    session?.user.id ?? null,
  );

  if (!result.error) {
    revalidatePath(`/staff/${staffId}`);
    revalidatePath("/settings/reports");
    revalidatePath("/today");
  }

  return result;
}
