import { notFound } from "next/navigation";
import { requireCurrentStaffSession } from "@/lib/staff-auth/session";
import { getStaff, getOwnHourlyWage } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForStaffMonth } from "@/lib/shifts/queries";
import { listTimeOffForRange } from "@/lib/time-off/queries";
import { estimatePayroll } from "@/lib/payroll";
import { toWorkedShifts } from "@/lib/shifts/worked-shift";
import { addDays, formatDateJapanese, monthOf, nextMonth, todayInTimezone } from "@/lib/date";
import { TimeOffCalendar } from "@/components/staff/TimeOffCalendar";
import { AvailabilityEditor } from "@/components/staff/AvailabilityEditor";

/** スタッフ本人の1画面完結ホーム(design handoff 1c)。管理者向け画面とは別ルート、招待リンクからのみ到達する。 */
export default async function StaffHomePage() {
  const { organizationId, staffId } = await requireCurrentStaffSession();
  const today = todayInTimezone();
  const nextMonthStart = `${nextMonth(monthOf(today))}-01`;

  const [staff, shiftTypes, hourlyWage, thisMonthAssignments, nextMonthAssignments, timeOff] =
    await Promise.all([
      getStaff(organizationId, staffId),
      listShiftTypes(organizationId),
      getOwnHourlyWage(organizationId, staffId),
      getAssignmentsForStaffMonth(organizationId, staffId, today),
      getAssignmentsForStaffMonth(organizationId, staffId, nextMonthStart),
      listTimeOffForRange(organizationId, today, addDays(today, 28)),
    ]);
  if (!staff) notFound();

  const shiftTypeById = new Map(shiftTypes.map((t) => [t.id, t]));
  const upcoming = [...thisMonthAssignments, ...nextMonthAssignments]
    .filter((a) => a.status === "confirmed" && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const upcomingShiftType = upcoming ? shiftTypeById.get(upcoming.shiftTypeId) : undefined;

  const payroll =
    hourlyWage != null
      ? estimatePayroll(toWorkedShifts(thisMonthAssignments, shiftTypeById), hourlyWage)
      : null;

  const ownTimeOffDates = new Set(
    timeOff.filter((t) => t.staffId === staffId).map((t) => t.date),
  );
  const next28Dates = Array.from({ length: 28 }, (_, i) => addDays(today, i));

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="px-4">
        {upcoming && upcomingShiftType ? (
          <div
            className="flex flex-col gap-1 rounded-[20px] p-5 text-white"
            style={{ background: "var(--color-primary)" }}
          >
            <p className="text-sm" style={{ color: "#FFE6CE" }}>
              {formatDateJapanese(upcoming.date)}
            </p>
            <p className="text-[27px] font-bold font-heading">
              {upcomingShiftType.name}({upcomingShiftType.startTime}〜{upcomingShiftType.endTime})
            </p>
          </div>
        ) : (
          <div className="rounded-[20px] border border-border bg-surface p-5">
            <p className="text-sm text-ink-weak">次の出勤予定はまだありません。</p>
          </div>
        )}
      </div>

      <div className="px-4">
        <p className="mb-2 text-sm font-bold text-ink">休み希望</p>
        <TimeOffCalendar dates={next28Dates} requestedDates={ownTimeOffDates} />
      </div>

      {payroll && (
        <div
          className="mx-4 flex flex-col gap-1 rounded-[16px] border p-3"
          style={{ borderColor: "var(--color-info-border)", background: "var(--color-info-soft)" }}
        >
          <p className="text-xs font-bold" style={{ color: "var(--color-info-ink)" }}>
            今月の給与見込み
          </p>
          <p className="text-2xl font-bold font-heading" style={{ color: "var(--color-info-ink)" }}>
            {payroll.estimatedPay.toLocaleString()}円
          </p>
        </div>
      )}

      <div className="mx-4">
        <AvailabilityEditor
          shiftTypes={shiftTypes}
          initialFixedDaysOff={staff.fixedDaysOff}
          initialUnavailableShiftTypeIds={staff.unavailableShiftTypeIds}
        />
      </div>
    </div>
  );
}
