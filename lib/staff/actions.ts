"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getScopedDb } from "@/lib/db/scopedClient";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { staff, staffCompensation } from "@/drizzle/schema";

export interface StaffInput {
  name: string;
  roleLabel: string;
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
  /** Only ever written when the caller is an owner — see docs/plan.md "時給をstaffから分離する理由". */
  hourlyWage: number | null;
}

export async function createStaff(input: StaffInput): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const { db } = getScopedDb(organizationId);

  try {
    const [created] = await db
      .insert(staff)
      .values({
        organizationId,
        name: input.name,
        roleLabel: input.roleLabel || null,
        fixedDaysOff: input.fixedDaysOff,
        unavailableShiftTypeIds: input.unavailableShiftTypeIds,
      })
      .returning({ id: staff.id });

    if (role === "owner" && input.hourlyWage != null) {
      await db.insert(staffCompensation).values({
        organizationId,
        staffId: created.id,
        hourlyWage: input.hourlyWage,
      });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "保存に失敗しました" };
  }

  revalidatePath("/staff");
  return { error: null };
}

export async function updateStaff(
  staffId: string,
  input: StaffInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const { db } = getScopedDb(organizationId);

  try {
    await db
      .update(staff)
      .set({
        name: input.name,
        roleLabel: input.roleLabel || null,
        fixedDaysOff: input.fixedDaysOff,
        unavailableShiftTypeIds: input.unavailableShiftTypeIds,
      })
      .where(and(eq(staff.id, staffId), eq(staff.organizationId, organizationId)));

    if (role === "owner" && input.hourlyWage != null) {
      await db
        .insert(staffCompensation)
        .values({ organizationId, staffId, hourlyWage: input.hourlyWage })
        .onConflictDoUpdate({
          target: staffCompensation.staffId,
          set: { hourlyWage: input.hourlyWage, updatedAt: new Date() },
        });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "保存に失敗しました" };
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
  return { error: null };
}

export async function deactivateStaff(staffId: string): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const { db } = getScopedDb(organizationId);
  await db
    .update(staff)
    .set({ isActive: false })
    .where(and(eq(staff.id, staffId), eq(staff.organizationId, organizationId)));

  revalidatePath("/staff");
  return { error: null };
}
