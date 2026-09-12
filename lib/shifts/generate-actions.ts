"use server";

import { revalidatePath } from "next/cache";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import {
  confirmDraftShifts as confirmDraftShiftsCore,
  discardDraftShifts as discardDraftShiftsCore,
  generateDraftShifts as generateDraftShiftsCore,
  type GenerateDraftResult,
} from "@/lib/shifts/generate";

/** Server Action wrapper around generateDraftShifts() — see lib/shifts/generate.ts for the actual logic. */
export async function generateDraftShifts(
  startDate: string,
  endDateExclusive: string,
): Promise<GenerateDraftResult> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await generateDraftShiftsCore(organizationId, startDate, endDateExclusive);
  if (!result.error) revalidatePath("/week");
  return result;
}

/** Server Action wrapper around confirmDraftShifts(). */
export async function confirmDraftShifts(
  startDate: string,
  endDateExclusive: string,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await confirmDraftShiftsCore(organizationId, startDate, endDateExclusive);
  if (!result.error) {
    revalidatePath("/week");
    revalidatePath("/today");
  }
  return result;
}

/** Server Action wrapper around discardDraftShifts(). */
export async function discardDraftShifts(
  startDate: string,
  endDateExclusive: string,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const result = await discardDraftShiftsCore(organizationId, startDate, endDateExclusive);
  if (!result.error) revalidatePath("/week");
  return result;
}
