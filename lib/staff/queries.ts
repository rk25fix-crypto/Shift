import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { staff, staffCompensation } from "@/drizzle/schema";
import type { MembershipRole } from "@/lib/org/current";

export interface StaffRecord {
  id: string;
  name: string;
  roleLabel: string | null;
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
  isActive: boolean;
}

export async function listStaff(organizationId: string): Promise<StaffRecord[]> {
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select()
    .from(staff)
    .where(and(eq(staff.organizationId, organizationId), eq(staff.isActive, true)))
    .orderBy(staff.name);

  return rows.map(toStaffRecord);
}

export async function getStaff(
  organizationId: string,
  staffId: string,
): Promise<StaffRecord | null> {
  const { db } = getScopedDb(organizationId);
  const [row] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.organizationId, organizationId), eq(staff.id, staffId)))
    .limit(1);

  return row ? toStaffRecord(row) : null;
}

/**
 * Owner-only — enforced here, not just by the caller, since D1 has no RLS
 * to fall back on (docs/plan.md "テナント分離モデル(D1版)"). A non-owner
 * role short-circuits to null without even querying, so a coworker's wage
 * can never leak through this function regardless of what calls it.
 */
export async function getStaffHourlyWage(
  organizationId: string,
  staffId: string,
  role: MembershipRole,
): Promise<number | null> {
  if (role !== "owner") return null;

  const { db } = getScopedDb(organizationId);
  const [row] = await db
    .select({ hourlyWage: staffCompensation.hourlyWage })
    .from(staffCompensation)
    .where(
      and(
        eq(staffCompensation.organizationId, organizationId),
        eq(staffCompensation.staffId, staffId),
      ),
    )
    .limit(1);

  return row?.hourlyWage ?? null;
}

/**
 * Self-view variant of getStaffHourlyWage() for app/staff-home/page.tsx — no
 * MembershipRole applies there (a staff self-service session isn't a
 * membership at all), so the owner-only gate above doesn't fit. Safe only
 * because every caller resolves staffId from
 * lib/staff-auth/session.ts's requireCurrentStaffSession(), never from
 * client input — there is no way to pass a different staffId and see a
 * coworker's wage through this path.
 */
export async function getOwnHourlyWage(
  organizationId: string,
  staffId: string,
): Promise<number | null> {
  const { db } = getScopedDb(organizationId);
  const [row] = await db
    .select({ hourlyWage: staffCompensation.hourlyWage })
    .from(staffCompensation)
    .where(
      and(
        eq(staffCompensation.organizationId, organizationId),
        eq(staffCompensation.staffId, staffId),
      ),
    )
    .limit(1);

  return row?.hourlyWage ?? null;
}

type StaffRow = typeof staff.$inferSelect;

function toStaffRecord(row: StaffRow): StaffRecord {
  return {
    id: row.id,
    name: row.name,
    roleLabel: row.roleLabel,
    fixedDaysOff: row.fixedDaysOff,
    unavailableShiftTypeIds: row.unavailableShiftTypeIds,
    isActive: row.isActive,
  };
}
