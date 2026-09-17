import { addDays } from "@/lib/date";
import { workedHours, type WorkedShift } from "@/lib/labor-rules";
import { estimatePayroll } from "@/lib/payroll";
import { listStaff, listHourlyWages } from "@/lib/staff/queries";
import { listShiftTypes, type ShiftTypeRecord } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import type { MembershipRole } from "@/lib/org/current";

export interface StaffHoursByShiftType {
  shiftTypeId: string;
  code: string;
  name: string;
  hours: number;
}

export interface StaffHoursRow {
  staffId: string;
  staffName: string;
  totalHours: number;
  byShiftType: StaffHoursByShiftType[];
  /** null when no hourly wage is set for this staff member, or the caller isn't an owner (see lib/staff/queries.ts's listHourlyWages). */
  estimatedPay: number | null;
}

export interface HoursReport {
  /** Shift types in registration order — the same order lib/shift-types/colors.ts's shiftTypeColor cycles through, so a legend built from this list matches the bars. */
  shiftTypes: ShiftTypeRecord[];
  rows: StaffHoursRow[];
  /** Sum of every row's estimatedPay — null when the caller isn't an owner (payroll section hidden entirely, docs/plan.md "時給をstaffから分離する理由"), not just when it happens to be zero. */
  totalPay: number | null;
}

/**
 * 管理者向け「誰がどの勤務で何時間・いくら働いたか」レポート(スタッフ
 * 本人には見せない — app/(app)/settings/reports/page.tsxでisManager()
 * ゲート)。確定済み(confirmed)の割当のみを対象にする — 下書きはまだ
 * 実際に働くかどうか確定していないため。
 *
 * 給与額はowner専用(listHourlyWages自体がrole!=="owner"でMapを空にして
 * 返す)。admin/staffロールで呼んだ場合、estimatedPay/totalPayは常にnull
 * になる — 時給を伏せるだけでなく、金額セクションごと表示しない前提。
 */
export async function getHoursReport(
  organizationId: string,
  role: MembershipRole,
  startDate: string,
  endDateExclusive: string,
): Promise<HoursReport> {
  const [staff, shiftTypes, assignments, hourlyWages] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    getAssignmentsForOrgRange(organizationId, startDate, endDateExclusive),
    listHourlyWages(organizationId, role),
  ]);

  const shiftTypeById = new Map(shiftTypes.map((t) => [t.id, t]));
  // staffId -> shiftTypeId -> total hours
  const hoursByStaffAndType = new Map<string, Map<string, number>>();
  // staffId -> every confirmed shift as a WorkedShift, for estimatePayroll()
  const workedShiftsByStaff = new Map<string, WorkedShift[]>();

  for (const a of assignments) {
    if (a.status !== "confirmed") continue;
    const shiftType = shiftTypeById.get(a.shiftTypeId);
    if (!shiftType) continue;

    const endDate = shiftType.crossesMidnight ? addDays(a.date, 1) : a.date;
    const shift: WorkedShift = {
      staffId: a.staffId,
      startsAt: `${a.date}T${shiftType.startTime}:00Z`,
      endsAt: `${endDate}T${shiftType.endTime}:00Z`,
      breakMinutes: shiftType.breakMinutes,
    };
    const hours = workedHours(shift);

    const byType = hoursByStaffAndType.get(a.staffId) ?? new Map<string, number>();
    byType.set(a.shiftTypeId, (byType.get(a.shiftTypeId) ?? 0) + hours);
    hoursByStaffAndType.set(a.staffId, byType);

    const shifts = workedShiftsByStaff.get(a.staffId) ?? [];
    shifts.push(shift);
    workedShiftsByStaff.set(a.staffId, shifts);
  }

  const rows: StaffHoursRow[] = staff
    .map((member) => {
      const byType = hoursByStaffAndType.get(member.id) ?? new Map<string, number>();
      const byShiftType: StaffHoursByShiftType[] = shiftTypes
        .filter((t) => byType.has(t.id))
        .map((t) => ({ shiftTypeId: t.id, code: t.code, name: t.name, hours: byType.get(t.id)! }));
      const totalHours = byShiftType.reduce((sum, t) => sum + t.hours, 0);

      const hourlyWage = hourlyWages.get(member.id);
      const shifts = workedShiftsByStaff.get(member.id) ?? [];
      const estimatedPay =
        hourlyWage != null && shifts.length > 0 ? estimatePayroll(shifts, hourlyWage).estimatedPay : null;

      return { staffId: member.id, staffName: member.name, totalHours, byShiftType, estimatedPay };
    })
    .filter((row) => row.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);

  const totalPay =
    role === "owner" ? rows.reduce((sum, r) => sum + (r.estimatedPay ?? 0), 0) : null;

  return { shiftTypes, rows, totalPay };
}
