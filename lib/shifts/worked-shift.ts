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
 * crossesMidnight rolls only the end date forward by one day.
 */
export function toWorkedShifts(
  assignments: Assignment[],
  shiftTypesById: Map<string, ShiftTypeTiming>,
): WorkedShift[] {
  const shifts: WorkedShift[] = [];

  for (const a of assignments) {
    const shiftType = shiftTypesById.get(a.shiftTypeId);
    if (!shiftType) continue; // shift type deleted since the assignment was made

    const endDate = shiftType.crossesMidnight ? addDays(a.date, 1) : a.date;
    shifts.push({
      staffId: a.staffId,
      startsAt: `${a.date}T${shiftType.startTime}:00Z`,
      endsAt: `${endDate}T${shiftType.endTime}:00Z`,
      breakMinutes: shiftType.breakMinutes,
    });
  }

  return shifts;
}
