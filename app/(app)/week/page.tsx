import Link from "next/link";
import { requireCurrentMembership } from "@/lib/org/current";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import { getLaborWarnings } from "@/lib/shifts/labor-warnings";
import { computeUnfilledDates } from "@/lib/shifts/unfilled-dates";
import { listTimeOffForRange } from "@/lib/time-off/queries";
import {
  addDays,
  datesInWeek,
  isValidIsoDate,
  mondayOf,
  monthOf,
  nextMonth,
  todayInTimezone,
} from "@/lib/date";
import { WeekGrid } from "@/components/shift/WeekGrid";
import { WeekActions } from "@/components/shift/WeekActions";
import { MonthActions } from "@/components/shift/MonthActions";
import { LaborWarningsList } from "@/components/shift/LaborWarningsList";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const { start: startParam } = await searchParams;
  const monday = mondayOf(
    startParam && isValidIsoDate(startParam) ? startParam : todayInTimezone(),
  );
  const dates = datesInWeek(monday);

  const { organizationId } = await requireCurrentMembership();
  const weekEndExclusive = addDays(monday, 7);
  const month = monthOf(monday);
  const monthStart = `${month}-01`;
  const monthEndExclusive = `${nextMonth(month)}-01`;
  // Started once, up front, and its promise reused below — getLaborWarnings
  // needs this same data internally, and re-fetching it there would be a
  // fully redundant D1 round-trip on every single week-view load. Passing
  // the in-flight promise (rather than awaiting it here first) keeps this
  // query parallel with the others instead of turning it into an extra
  // serial round-trip in front of them.
  const shiftTypesPromise = listShiftTypes(organizationId);
  const [shiftTypes, staff, assignments, timeOff, warnings] = await Promise.all([
    shiftTypesPromise,
    listStaff(organizationId),
    getAssignmentsForOrgRange(organizationId, monday, weekEndExclusive, { includeDrafts: true }),
    listTimeOffForRange(organizationId, monday, weekEndExclusive),
    // includeDrafts here too: a manager should see a problem before
    // confirming a generated shift, not only after.
    getLaborWarnings(organizationId, monday, weekEndExclusive, {
      includeDrafts: true,
      shiftTypes: shiftTypesPromise,
    }),
  ]);
  const hasRequiredShiftTypes = shiftTypes.some((t) => t.isRequired);
  const hasDrafts = assignments.some((a) => a.status === "draft");
  const staffIdsWithWarnings = new Set([
    ...warnings.consecutiveDayViolations.map((v) => v.staffId),
    ...warnings.hoursViolations.map((v) => v.staffId),
    ...warnings.breakViolations.map((v) => v.staffId),
  ]);
  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const unfilledDates = computeUnfilledDates(
    dates,
    shiftTypes.filter((t) => t.isRequired),
    assignments,
  );

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex items-center justify-between px-4">
        <Link
          href={`/week?start=${addDays(monday, -7)}`}
          aria-label="前の週"
          className="p-2 text-xl text-gray-500"
        >
          ‹
        </Link>
        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold">
            {dates[0].slice(5).replace("-", "/")}〜{dates[6].slice(5).replace("-", "/")}
          </h1>
          <Link href="/week" className="text-xs text-indigo-600">
            今週へ
          </Link>
        </div>
        <Link
          href={`/week?start=${addDays(monday, 7)}`}
          aria-label="次の週"
          className="p-2 text-xl text-gray-500"
        >
          ›
        </Link>
      </div>
      <WeekActions
        startDate={monday}
        endDateExclusive={weekEndExclusive}
        hasRequiredShiftTypes={hasRequiredShiftTypes}
        hasDrafts={hasDrafts}
      />
      {hasRequiredShiftTypes && (
        <MonthActions month={month} monthStart={monthStart} monthEndExclusive={monthEndExclusive} />
      )}
      {/* Explains what each ⚠ in the grid below actually means — a bare
          icon next to a name gives no way to tell why without this. */}
      <LaborWarningsList warnings={warnings} staffNameById={staffNameById} />
      <WeekGrid
        dates={dates}
        staff={staff}
        shiftTypes={shiftTypes}
        assignments={assignments}
        timeOff={timeOff}
        staffIdsWithWarnings={staffIdsWithWarnings}
        unfilledDates={unfilledDates}
      />
    </div>
  );
}
