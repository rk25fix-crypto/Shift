import type { MembershipRole } from "@/lib/org/current";
import { estimatePayroll, type PayrollPremiumBreakdown } from "@/lib/payroll";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForStaffMonth } from "@/lib/shifts/queries";
import { toWorkedShifts } from "@/lib/shifts/worked-shift";
import { getStaffHourlyWage } from "@/lib/staff/queries";

export interface StaffPayrollEstimate {
  hourlyWage: number;
  totalHours: number;
  estimatedPay: number;
  premiums: PayrollPremiumBreakdown;
}

/**
 * 指定スタッフの当月概算給与(確定済みシフトのみ、時給×勤務時間)。
 * getStaffHourlyWageと同じくowner専用 — role !== "owner"ならDBを読まずnullを
 * 返す(D1にRLSが無いため、この関数自身がテナント/権限分離の最終防壁になる、
 * lib/staff/queries.tsのgetStaffHourlyWageと同じ設計)。時給が未設定の場合も
 * 概算を出しようがないためnullを返す。
 */
export async function getStaffPayrollEstimate(
  organizationId: string,
  staffId: string,
  role: MembershipRole,
  date: string,
): Promise<StaffPayrollEstimate | null> {
  const hourlyWage = await getStaffHourlyWage(organizationId, staffId, role);
  if (hourlyWage === null) return null;

  const [shiftTypes, assignments] = await Promise.all([
    listShiftTypes(organizationId),
    getAssignmentsForStaffMonth(organizationId, staffId, date),
  ]);
  const shiftTypesById = new Map(shiftTypes.map((t) => [t.id, t]));
  const workedShifts = toWorkedShifts(assignments, shiftTypesById);
  const { totalHours, estimatedPay, premiums } = estimatePayroll(workedShifts, hourlyWage);

  return { hourlyWage, totalHours, estimatedPay, premiums };
}
