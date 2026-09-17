import { addDays } from "@/lib/date";
import { workedHours, type WorkedShift } from "@/lib/labor-rules";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes, type ShiftTypeRecord } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";

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
}

export interface HoursReport {
  /** Shift types in registration order — the same order lib/shift-types/colors.ts's shiftTypeColor cycles through, so a legend built from this list matches the bars. */
  shiftTypes: ShiftTypeRecord[];
  rows: StaffHoursRow[];
}

/**
 * 管理者向け「誰がどの勤務で何時間働いたか」レポート(スタッフ本人には
 * 見せない — app/(app)/settings/reports/page.tsxでisManager()ゲート)。
 * 確定済み(confirmed)の割当のみを対象にする — 下書きはまだ実際に働く
 * かどうか確定していないため。
 */
export async function getHoursReport(
  organizationId: string,
  startDate: string,
  endDateExclusive: string,
): Promise<HoursReport> {
  const [staff, shiftTypes, assignments] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    getAssignmentsForOrgRange(organizationId, startDate, endDateExclusive),
  ]);

  const shiftTypeById = new Map(shiftTypes.map((t) => [t.id, t]));
  // staffId -> shiftTypeId -> total hours
  const hoursByStaffAndType = new Map<string, Map<string, number>>();

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
  }

  const rows: StaffHoursRow[] = staff
    .map((member) => {
      const byType = hoursByStaffAndType.get(member.id) ?? new Map<string, number>();
      const byShiftType: StaffHoursByShiftType[] = shiftTypes
        .filter((t) => byType.has(t.id))
        .map((t) => ({ shiftTypeId: t.id, code: t.code, name: t.name, hours: byType.get(t.id)! }));
      const totalHours = byShiftType.reduce((sum, t) => sum + t.hours, 0);
      return { staffId: member.id, staffName: member.name, totalHours, byShiftType };
    })
    .filter((row) => row.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours);

  return { shiftTypes, rows };
}
