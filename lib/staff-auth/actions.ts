"use server";

import { revalidatePath } from "next/cache";
import { claimInviteCore } from "@/lib/staff-invites/write";
import { setStaffSessionCookie, requireCurrentStaffSession } from "@/lib/staff-auth/session";
import { setTimeOffRequest } from "@/lib/time-off/set";
import { updateStaffAvailabilityCore } from "@/lib/staff/write";

/** Public: claims an invite token and starts the staff's own session — no membership/role involved. */
export async function claimStaffInvite(
  token: string,
  input: { fixedDaysOff: number[]; unavailableShiftTypeIds: string[] },
): Promise<{ error: string | null }> {
  const result = await claimInviteCore(token, input);
  if ("error" in result) return { error: result.error };

  await setStaffSessionCookie(result.sessionToken);
  return { error: null };
}

/**
 * Staff-side equivalent of lib/time-off/actions.ts's requestTimeOff — same
 * underlying write, but gated by the staff's own session instead of an
 * isManager() membership check. requireCurrentStaffSession() already ties
 * staffId to the session cookie, so there is no staffId parameter to trust
 * from the client here (unlike the admin version, which picks a staffId to
 * act on for someone else).
 */
export async function requestOwnTimeOff(date: string): Promise<{ error: string | null }> {
  const { organizationId, staffId } = await requireCurrentStaffSession();
  const result = await setTimeOffRequest(organizationId, staffId, date, null);
  if (!result.error) revalidatePath("/staff-home");
  return result;
}

/** Staff-side: revisit the availability entered at invite time (lib/staff/write.ts's updateStaffAvailabilityCore). */
export async function updateOwnAvailability(input: {
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
}): Promise<{ error: string | null }> {
  const { organizationId, staffId } = await requireCurrentStaffSession();
  const result = await updateStaffAvailabilityCore(organizationId, staffId, input);
  if (!result.error) revalidatePath("/staff-home");
  return result;
}
