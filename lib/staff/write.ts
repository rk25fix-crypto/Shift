import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { staff, staffCompensation } from "@/drizzle/schema";
import type { MembershipRole } from "@/lib/org/current";

export interface StaffInput {
  name: string;
  roleLabel: string;
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
  /** Only ever written when the caller is an owner — see docs/plan.md "時給をstaffから分離する理由". */
  hourlyWage: number | null;
}

/**
 * Core of createStaff/updateStaff/deactivateStaff (lib/staff/actions.ts),
 * extracted so they can be exercised directly in
 * lib/db/scopedClient.isolation.d1.test.ts without a real Next.js request
 * context — same split as lib/shifts/assign.ts's setShiftAssignment.
 */
export async function createStaffCore(
  organizationId: string,
  role: MembershipRole,
  input: StaffInput,
): Promise<{ error: string | null }> {
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

  return { error: null };
}

export async function updateStaffCore(
  organizationId: string,
  role: MembershipRole,
  staffId: string,
  input: StaffInput,
): Promise<{ error: string | null }> {
  const { db } = getScopedDb(organizationId);

  try {
    // staffCompensation.staffId is unique with no organizationId guard on
    // its own — the onConflictDoUpdate below would happily overwrite
    // another org's wage row (or insert an orphaned one) for a staffId that
    // doesn't belong to this org, since D1 has no RLS to catch it. Resolving
    // staffId against this org first, before touching either table, is the
    // only backstop (same pattern as lib/shifts/assign.ts's setShiftAssignment).
    const [staffRow] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, staffId), eq(staff.organizationId, organizationId)));
    if (!staffRow) return { error: "スタッフが見つかりません" };

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

  return { error: null };
}

export async function deactivateStaffCore(
  organizationId: string,
  staffId: string,
): Promise<{ error: string | null }> {
  const { db } = getScopedDb(organizationId);
  await db
    .update(staff)
    .set({ isActive: false })
    .where(and(eq(staff.id, staffId), eq(staff.organizationId, organizationId)));

  return { error: null };
}
