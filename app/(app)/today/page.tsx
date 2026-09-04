import Link from "next/link";
import { requireCurrentMembership } from "@/lib/org/current";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForDate } from "@/lib/shifts/queries";
import { addDays, formatDateJapanese, todayInTimezone } from "@/lib/date";
import { DayList } from "@/components/shift/DayList";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? todayInTimezone();

  const { organizationId } = await requireCurrentMembership();
  const [staff, shiftTypes, assignments] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    getAssignmentsForDate(organizationId, date),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex items-center justify-between px-4">
        <Link
          href={`/today?date=${addDays(date, -1)}`}
          aria-label="前の日"
          className="p-2 text-xl text-gray-500"
        >
          ‹
        </Link>
        <h1 className="text-lg font-bold">{formatDateJapanese(date)}</h1>
        <Link
          href={`/today?date=${addDays(date, 1)}`}
          aria-label="次の日"
          className="p-2 text-xl text-gray-500"
        >
          ›
        </Link>
      </div>
      <DayList date={date} staff={staff} shiftTypes={shiftTypes} assignments={assignments} />
    </div>
  );
}
