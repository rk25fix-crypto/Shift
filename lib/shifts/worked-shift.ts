import { addDays } from "@/lib/date";
import type { Assignment } from "@/lib/shifts/queries";
import type { WorkedShift } from "@/lib/labor-rules";

/** The subset of a shift type's fields needed to resolve an assignment to actual clock times. */
export interface ShiftTypeTiming {
  id: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  crossesMidnight: boolean;
  breakMinutes: number;
}

/**
 * Resolves one assignment's clock-in/out — the staff-recorded
 * actualStartTime/actualEndTime (lib/shifts/actual-time.ts) when both are
 * present, falling back to the shift type's own scheduled times otherwise.
 * The schedule is a plan; the actual record (entered once at day's end,
 * app/staff-home/page.tsx's ActualTimeRecorder) is what really happened, so
 * every hours/payroll calculation should prefer it when it exists.
 *
 * Date rollover for the end time always follows the shift type's own
 * crossesMidnight flag, not a comparison of the clock times themselves —
 * an actual time is a correction to when a shift started/ended (a bit
 * early, a bit late), not a claim that the shift now belongs to a
 * different calendar day.
 */
export function resolveAssignmentTimes(
  assignment: Pick<Assignment, "date" | "actualStartTime" | "actualEndTime">,
  shiftType: ShiftTypeTiming,
): { startsAt: string; endsAt: string; breakMinutes: number } {
  const startTime = assignment.actualStartTime ?? shiftType.startTime;
  const endTime = assignment.actualEndTime ?? shiftType.endTime;
  const endDate = shiftType.crossesMidnight ? addDays(assignment.date, 1) : assignment.date;

  return {
    startsAt: `${assignment.date}T${startTime}:00Z`,
    endsAt: `${endDate}T${endTime}:00Z`,
    breakMinutes: shiftType.breakMinutes,
  };
}

/**
 * Converts confirmed/draft assignments into lib/labor-rules.ts's WorkedShift
 * shape. A pure function on purpose (unlike lib/shifts/queries.ts, which
 * needs getScopedDb and so can only run under vitest.d1.config.ts) so this
 * conversion — and the "walk-clock time written with a Z suffix" convention
 * it relies on — can be unit-tested under plain vitest.config.ts.
 *
 * Builds startsAt/endsAt as `${date}T${time}:00Z` — a deliberate
 * pseudo-UTC encoding of local wall-clock time, matching
 * lib/labor-rules.test.ts's existing convention. Using a real timezone
 * offset here would double-convert once lib/labor-rules.ts's own date-only
 * arithmetic (shiftDate(), daysBetween()) re-slices these strings.
 */
export function toWorkedShifts(
  assignments: Assignment[],
  shiftTypesById: Map<string, ShiftTypeTiming>,
): WorkedShift[] {
  const shifts: WorkedShift[] = [];

  for (const a of assignments) {
    const shiftType = shiftTypesById.get(a.shiftTypeId);
    if (!shiftType) continue; // shift type deleted since the assignment was made

    shifts.push({ staffId: a.staffId, ...resolveAssignmentTimes(a, shiftType) });
  }

  return shifts;
}
