import Link from "next/link";
import { requireCurrentMembership } from "@/lib/org/current";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import { addDays, datesInWeek, isValidIsoDate, mondayOf, todayInTimezone } from "@/lib/date";
import { WeekGrid } from "@/components/shift/WeekGrid";

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
  const [staff, shiftTypes, assignments] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    getAssignmentsForOrgRange(organizationId, monday, addDays(monday, 7)),
  ]);

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
      <WeekGrid dates={dates} staff={staff} shiftTypes={shiftTypes} assignments={assignments} />
    </div>
  );
}
