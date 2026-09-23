"use server";

import { revalidatePath } from "next/cache";
import { claimInviteCore, claimPairingCodeCore, createPairingCodeCore } from "@/lib/staff-invites/write";
import { deletePushSubscriptionCore, upsertPushSubscriptionCore } from "@/lib/push/subscriptions";
import { setStaffSessionCookie, getCurrentStaffSession } from "@/lib/staff-auth/session";
import { requestOwnTimeOff as requestOwnTimeOffCore } from "@/lib/time-off/set";
import { updateStaffAvailabilityCore } from "@/lib/staff/write";
import { recordActualShiftTimeCore } from "@/lib/shifts/actual-time";

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

/**
 * Staff-side: records actual clock-in/out for today's (or any confirmed)
 * shift (lib/shifts/actual-time.ts's recordActualShiftTimeCore) — same
 * "staffId always comes from the session, never the client" boundary as
 * every other action here.
 */
export async function recordOwnActualShiftTime(
  date: string,
  actualStartTime: string,
  actualEndTime: string,
): Promise<{ error: string | null }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "セッションが見つかりません。招待リンクをもう一度開いてください。" };

  const result = await recordActualShiftTimeCore(
    session.organizationId,
    session.staffId,
    date,
    actualStartTime,
    actualEndTime,
  );
  if (!result.error) revalidatePath("/staff-home");
  return result;
}

/** Staff-side: mints a 10-minute code to sign in the home-screen copy of the app (lib/staff-invites/write.ts's createPairingCodeCore). */
export async function createOwnPairingCode(): Promise<{ code: string | null; error: string | null }> {
  const session = await getCurrentStaffSession();
  if (!session) return { code: null, error: "セッションが見つかりません。招待リンクをもう一度開いてください。" };
  return createPairingCodeCore(session.organizationId, session.staffId);
}

/** Public: exchanges a pairing code for a staff session on this device — no membership/role involved, same as claimStaffInvite. */
export async function claimPairingCode(code: string): Promise<{ error: string | null }> {
  const result = await claimPairingCodeCore(code);
  if ("error" in result) return { error: result.error };

  await setStaffSessionCookie(result.sessionToken);
  return { error: null };
}

/** Staff-side: registers this device for Web Push (lib/push/subscriptions.ts). Identity comes from the session only. */
export async function subscribeOwnPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ error: string | null }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "セッションが見つかりません。招待リンクをもう一度開いてください。" };
  return upsertPushSubscriptionCore(session, input);
}

export async function unsubscribeOwnPush(endpoint: string): Promise<{ error: string | null }> {
  const session = await getCurrentStaffSession();
  if (!session) return { error: "セッションが見つかりません。招待リンクをもう一度開いてください。" };
  return deletePushSubscriptionCore(session.organizationId, session.staffId, endpoint);
}
