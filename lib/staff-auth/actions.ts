"use server";

import { revalidatePath } from "next/cache";
import { claimInviteCore } from "@/lib/staff-invites/write";
import { setStaffSessionCookie, getCurrentStaffSession } from "@/lib/staff-auth/session";
import { requestOwnTimeOff as requestOwnTimeOffCore } from "@/lib/time-off/set";
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
 * Staff-side: submits the staff's own day-off request. getCurrentStaffSession()
 * ties staffId to the session cookie, so there is no staffId parameter to
 * trust from the client here (unlike the admin version, which picks a
 * staffId to act on for someone else). Uses lib/time-off/set.ts's
 * requestOwnTimeOff — deliberately a different write than the admin proxy
 * path (setTimeOffRequest): see that function's docstring for why a staff
 * member's own tap must never silently clear a confirmed shift.
 */
export async function requestOwnTimeOff(date: string): Promise<{ error: string | null }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "セッションが見つかりません。招待リンクをもう一度開いてください。" };

  const result = await requestOwnTimeOffCore(session.organizationId, session.staffId, date);
  if (!result.error) revalidatePath("/staff-home");
  return result;
}

/** Staff-side: revisit the availability entered at invite time (lib/staff/write.ts's updateStaffAvailabilityCore). */
export async function updateOwnAvailability(input: {
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
}): Promise<{ error: string | null }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "セッションが見つかりません。招待リンクをもう一度開いてください。" };

  const result = await updateStaffAvailabilityCore(session.organizationId, session.staffId, input);
  if (!result.error) revalidatePath("/staff-home");
  return result;
}
