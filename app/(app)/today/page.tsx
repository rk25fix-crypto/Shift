import Link from "next/link";
import { listMembershipsForCurrentUser, requireCurrentMembership } from "@/lib/org/current";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import { listTimeOffForRange } from "@/lib/time-off/queries";
import { computeUnfilledDates } from "@/lib/shifts/unfilled-dates";
import { addDays, datesInWeek, formatDateJapanese, isValidIsoDate, mondayOf, todayInTimezone } from "@/lib/date";
import { DayList } from "@/components/shift/DayList";
import { DateStrip } from "@/components/shift/DateStrip";
import { DateJumpForm } from "@/components/shift/DateJumpForm";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam && isValidIsoDate(dateParam) ? dateParam : todayInTimezone();
  const monday = mondayOf(date);
  const weekDates = datesInWeek(monday);
  const weekEndExclusive = addDays(monday, 7);

  const { organizationId } = await requireCurrentMembership();
  const [staff, shiftTypes, memberships, weekAssignments, weekTimeOff] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    listMembershipsForCurrentUser(),
    getAssignmentsForOrgRange(organizationId, monday, weekEndExclusive, { includeDrafts: true }),
    listTimeOffForRange(organizationId, monday, weekEndExclusive),
  ]);

  const organizationName = memberships.find((m) => m.organizationId === organizationId)?.organizationName ?? "";
  const requiredShiftTypes = shiftTypes.filter((t) => t.isRequired);
  // includeDrafts: true (same choice /week makes) — the DateStrip dot means
  // "someone is slotted for every required shift," draft or confirmed, so a
  // manager sees a day needs attention before generating/confirming, not
  // only after. The DayList below still only shows confirmed assignments.
  const unfilledDates = computeUnfilledDates(weekDates, requiredShiftTypes, weekAssignments);
  const filledDates = new Set(weekDates.filter((d) => !unfilledDates.has(d)));

  const assignments = weekAssignments.filter((a) => a.date === date && a.status === "confirmed");
  const timeOff = weekTimeOff.filter((t) => t.date === date);

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex items-center justify-between px-4">
        <div>
          <p className="text-[11px] font-bold text-ink-weakest">{organizationName}</p>
          <h1 className="text-xl font-bold font-heading text-ink">{formatDateJapanese(date)}</h1>
        </div>
        <Link
          href={`/week?start=${monday}`}
          className="rounded-full border border-primary-soft-border bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-ink"
        >
          今週
        </Link>
      </div>
      <DateStrip dates={weekDates} selectedDate={date} filledDates={filledDates} />
      <DateJumpForm date={date} />
      <DayList date={date} staff={staff} shiftTypes={shiftTypes} assignments={assignments} timeOff={timeOff} />
      <Link
        href={`/week?start=${monday}`}
        className="fixed inset-x-0 z-10 mx-auto w-fit rounded-full px-5 py-3 text-sm font-bold font-heading text-white shadow-[0_6px_16px_rgba(196,96,31,.28)]"
        style={{ background: "var(--color-primary)", bottom: "calc(env(safe-area-inset-bottom) + 78px)" }}
      >
        週表示で自動で組む
      </Link>
    </div>
  );
}
