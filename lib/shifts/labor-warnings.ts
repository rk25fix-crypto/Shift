import { addDays } from "@/lib/date";
import {
  detectBreakViolations,
  detectConsecutiveDayViolations,
  detectHoursViolations,
  filterBreakViolationsToRange,
  filterConsecutiveDayViolationsToRange,
  filterHoursViolationsToRange,
  type BreakViolation,
  type ConsecutiveDaysViolation,
  type HoursViolation,
} from "@/lib/labor-rules";
import { getWorkRuleSettings } from "@/lib/org/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import { toWorkedShifts } from "@/lib/shifts/worked-shift";

// See lib/labor-rules.ts's detect* docstrings — a run/week/month can start
// before the range being displayed, so violations must be detected over a
// wider window than what's shown, then filtered back down to it. This is a
// floor, not a fixed value: an org's maxConsecutiveDays can exceed it (no UI
// yet to set it, but the column already exists), so the actual lookback
// widens to cover that threshold too — otherwise a streak starting just
// before displayStart could be missed at the org's own configured limit.
const MIN_LOOKBACK_DAYS = 7;

export interface LaborWarnings {
  consecutiveDayViolations: ConsecutiveDaysViolation[];
  hoursViolations: HoursViolation[];
  breakViolations: BreakViolation[];
}

/**
 * Org-wide 勤務ルール警告 for `[displayStart, displayEndExclusive)` — callers
 * filter the result arrays by staffId themselves when showing just one
 * staff member (e.g. StaffMonthShifts). Confirmed-only by default; pass
 * `includeDrafts` for the week view, which is the one screen that shows
 * warnings for not-yet-confirmed shifts too, so a manager sees a problem
 * before publishing it rather than after.
 */
export async function getLaborWarnings(
  organizationId: string,
  displayStart: string,
  displayEndExclusive: string,
  options?: { includeDrafts?: boolean },
): Promise<LaborWarnings> {
  const settings = await getWorkRuleSettings(organizationId);
  const lookbackDays = Math.max(MIN_LOOKBACK_DAYS, settings.maxConsecutiveDays);
  const lookbackStart = addDays(displayStart, -lookbackDays);

  const [shiftTypes, assignments] = await Promise.all([
    listShiftTypes(organizationId),
    getAssignmentsForOrgRange(organizationId, lookbackStart, displayEndExclusive, options),
  ]);

  const shiftTypesById = new Map(shiftTypes.map((t) => [t.id, t]));
  const workedShifts = toWorkedShifts(assignments, shiftTypesById);

  return {
    consecutiveDayViolations: filterConsecutiveDayViolationsToRange(
      detectConsecutiveDayViolations(workedShifts, settings),
      displayStart,
      displayEndExclusive,
    ),
    hoursViolations: filterHoursViolationsToRange(
      detectHoursViolations(workedShifts, settings),
      displayStart,
      displayEndExclusive,
    ),
    breakViolations: filterBreakViolationsToRange(
      detectBreakViolations(workedShifts, settings),
      displayStart,
      displayEndExclusive,
    ),
  };
}
