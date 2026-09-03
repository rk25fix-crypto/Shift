"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getScopedDb } from "@/lib/db/scopedClient";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { auth } from "@/lib/auth/config";
import { shiftAssignments } from "@/drizzle/schema";

/**
 * Sets (or clears, when shiftTypeId is null) the one shift a staff member
 * holds on a given date. The schema allows more than one shift per day
 * (shift_assignments' unique key includes shift_type_id — see
 * docs/plan.md), but the Today view keeps to "tap a chip, pick one shift"
 * for Phase 1a, matching lib/shift-generator's one-shift-a-day model. A
 * manager who genuinely needs a second shift that day can add it once the
 * data model's multi-shift support gets a UI (Phase 1b+).
 */
export async function assignShift(
  staffId: string,
  date: string,
  shiftTypeId: string | null,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const { db } = getScopedDb(organizationId);

  await db
    .delete(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.staffId, staffId),
        eq(shiftAssignments.date, date),
      ),
    );

  if (shiftTypeId) {
    const session = await auth.api.getSession({ headers: await headers() });

    try {
      await db.insert(shiftAssignments).values({
        organizationId,
        staffId,
        shiftTypeId,
        date,
        status: "confirmed",
        createdBy: session?.user.id ?? null,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "保存に失敗しました" };
    }
  }

  revalidatePath("/today");
  revalidatePath(`/staff/${staffId}`);
  return { error: null };
}
