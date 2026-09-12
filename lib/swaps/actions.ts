"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { auth } from "@/lib/auth/config";
import { createSwapRequestCore, decideSwapRequestCore, type SwapRequestInput } from "@/lib/swaps/write";

export type { SwapRequestInput };

/** Server Action wrapper around createSwapRequestCore() — see lib/swaps/write.ts for the actual logic. */
export async function requestSwap(input: SwapRequestInput): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await createSwapRequestCore(organizationId, session?.user.id ?? null, input);

  if (!result.error) revalidatePath("/swaps");
  return result;
}

/** Server Action wrapper around decideSwapRequestCore() — see lib/swaps/write.ts for the actual logic. */
export async function decideSwap(
  swapRequestId: string,
  decision: "approved" | "rejected",
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const session = await auth.api.getSession({ headers: await headers() });
  const result = await decideSwapRequestCore(
    organizationId,
    session?.user.id ?? null,
    swapRequestId,
    decision,
  );

  if (!result.error) {
    revalidatePath("/swaps");
    revalidatePath("/today");
    revalidatePath("/week");
  }
  return result;
}
