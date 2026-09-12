"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { auth } from "@/lib/auth/config";
import { setTimeOffRequest } from "@/lib/time-off/set";

/** Server Action wrapper around setTimeOffRequest() — see lib/time-off/set.ts for the actual logic. */
export async function requestTimeOff(
  staffId: string,
  date: string,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await setTimeOffRequest(organizationId, staffId, date, session?.user.id ?? null);

  if (!result.error) {
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath(`/staff/${staffId}`);
  }

  return result;
}
