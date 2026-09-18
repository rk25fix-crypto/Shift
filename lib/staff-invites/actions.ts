"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { createInviteCore } from "@/lib/staff-invites/write";

/** Admin-side: (re)issue an invite link for one staff member. Returns the full URL to share. */
export async function createStaffInvite(
  staffId: string,
): Promise<{ url: string | null; error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { url: null, error: "権限がありません" };

  const { token, error } = await createInviteCore(organizationId, staffId);
  if (error) return { url: null, error };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  revalidatePath(`/staff/${staffId}`);
  return { url: `${origin}/invite/${token}`, error: null };
}
