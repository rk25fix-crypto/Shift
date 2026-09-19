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
import { listShiftTypes, type ShiftTypeRecord } from "@/lib/shift-types/queries";
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
  options?: {
    includeDrafts?: boolean;
    /**
     * Pass this when the caller already fetched (or is already fetching)
     * the org's shift types for its own purposes (nearly every page that
     * calls getLaborWarnings does) — skips a fully redundant D1 round-trip
     * for the exact same rows. Each of these round-trips is cheap on its
     * own, but they compound: the week and staff-detail pages were each
     * making 2-4 duplicate queries just from this one call before this
     * option existed. Accepts a promise (not just the resolved array) so a
     * caller can pass its own in-flight `listShiftTypes()` call straight
     * into this function's `Promise.all` below instead of awaiting it
     * first — awaiting it first would turn a parallel fetch into a serial
     * one, undoing the point of avoiding the duplicate query.
     */
    shiftTypes?: ShiftTypeRecord[] | Promise<ShiftTypeRecord[]>;
  },
): Promise<LaborWarnings> {
  const settings = await getWorkRuleSettings(organizationId);
  const lookbackDays = Math.max(MIN_LOOKBACK_DAYS, settings.maxConsecutiveDays);
  const lookbackStart = addDays(displayStart, -lookbackDays);

  const [shiftTypes, assignments] = await Promise.all([
    options?.shiftTypes ?? listShiftTypes(organizationId),
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
