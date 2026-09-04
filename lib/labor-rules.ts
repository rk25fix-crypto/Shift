/**
 * Pure functions for "勤務ルール警告" (work-rule warnings).
 *
 * Deliberately NOT named "labor law" anywhere user-facing: consecutive-day
 * and hours thresholds here are configurable heuristics an org sets for
 * itself, not a restatement of the Labor Standards Act. See
 * docs/plan.md ("iPhone向けUIの核心方針") for why that distinction matters.
 */

export interface WorkRuleSettings {
  maxConsecutiveDays: number;
  maxWeeklyHours: number;
  maxMonthlyHours: number;
  minBreakMinutesOverSixHours: number;
  minBreakMinutesOverEightHours: number;
}

export const DEFAULT_WORK_RULE_SETTINGS: WorkRuleSettings = {
  maxConsecutiveDays: 6,
  maxWeeklyHours: 40,
  maxMonthlyHours: 160,
  minBreakMinutesOverSixHours: 45,
  minBreakMinutesOverEightHours: 60,
};

/** One worked shift, already resolved to actual clock times. */
export interface WorkedShift {
  staffId: string;
  /** Shift start, as a full ISO-8601 instant (date + time), e.g. from combining shift_assignments.date + shift_types.start_time. */
  startsAt: string;
  /** Shift end, as a full ISO-8601 instant — later than startsAt even when the shift crosses midnight. */
  endsAt: string;
  breakMinutes: number;
}

export interface ConsecutiveDaysViolation {
  staffId: string;
  /** ISO date (YYYY-MM-DD) the run started. */
  startDate: string;
  /** ISO date (YYYY-MM-DD) the run ended. */
  endDate: string;
  consecutiveDays: number;
}

export interface HoursViolation {
  staffId: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  limitHours: number;
  period: "week" | "month";
}

export interface BreakViolation {
  staffId: string;
  date: string;
  workedMinutes: number;
  breakMinutes: number;
  requiredBreakMinutes: number;
}

function workedHours(shift: WorkedShift): number {
  const ms = new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime();
  return Math.max(0, ms / 1000 / 60 / 60 - shift.breakMinutes / 60);
}

/** The calendar date (YYYY-MM-DD) a shift's start falls on, for grouping. */
function shiftDate(shift: WorkedShift): string {
  return shift.startsAt.slice(0, 10);
}

/**
 * Detects runs of consecutive worked days longer than the configured limit.
 * `shifts` should include a lookback window (e.g. the prior 7 days) so a
 * run that started in the previous month is still detected — callers must
 * not pass only the current calendar month in isolation.
 */
export function detectConsecutiveDayViolations(
  shifts: WorkedShift[],
  settings: WorkRuleSettings = DEFAULT_WORK_RULE_SETTINGS,
): ConsecutiveDaysViolation[] {
  const byStaff = groupBy(shifts, (s) => s.staffId);
  const violations: ConsecutiveDaysViolation[] = [];

  for (const [staffId, staffShifts] of byStaff) {
    const workedDates = Array.from(new Set(staffShifts.map(shiftDate))).sort();

    let runStart = 0;
    for (let i = 1; i <= workedDates.length; i++) {
      const brokeStreak =
        i === workedDates.length ||
        daysBetween(workedDates[i - 1], workedDates[i]) > 1;

      if (brokeStreak) {
        const runLength = i - runStart;
        if (runLength > settings.maxConsecutiveDays) {
          violations.push({
            staffId,
            startDate: workedDates[runStart],
            endDate: workedDates[i - 1],
            consecutiveDays: runLength,
          });
        }
        runStart = i;
      }
    }
  }

  return violations;
}

/** Total worked hours per staff member for the given shifts, grouped by ISO week (Mon-start) and by month. */
export function detectHoursViolations(
  shifts: WorkedShift[],
  settings: WorkRuleSettings = DEFAULT_WORK_RULE_SETTINGS,
): HoursViolation[] {
  const violations: HoursViolation[] = [];
  const byStaff = groupBy(shifts, (s) => s.staffId);

  for (const [staffId, staffShifts] of byStaff) {
    const byMonth = groupBy(staffShifts, (s) => shiftDate(s).slice(0, 7));
    for (const [month, monthShifts] of byMonth) {
      const totalHours = monthShifts.reduce((sum, s) => sum + workedHours(s), 0);
      if (totalHours > settings.maxMonthlyHours) {
        violations.push({
          staffId,
          periodStart: `${month}-01`,
          periodEnd: `${month}-31`,
          totalHours: round1(totalHours),
          limitHours: settings.maxMonthlyHours,
          period: "month",
        });
      }
    }

    const byWeek = groupBy(staffShifts, (s) => isoWeekKey(shiftDate(s)));
    for (const weekShifts of byWeek.values()) {
      const totalHours = weekShifts.reduce((sum, s) => sum + workedHours(s), 0);
      if (totalHours > settings.maxWeeklyHours) {
        const dates = weekShifts.map(shiftDate).sort();
        violations.push({
          staffId,
          periodStart: dates[0],
          periodEnd: dates[dates.length - 1],
          totalHours: round1(totalHours),
          limitHours: settings.maxWeeklyHours,
          period: "week",
        });
      }
    }
  }

  return violations;
}

/** Flags shifts whose break is short of the statutory minimum for their length (6h→45min, 8h→60min). */
export function detectBreakViolations(
  shifts: WorkedShift[],
  settings: WorkRuleSettings = DEFAULT_WORK_RULE_SETTINGS,
): BreakViolation[] {
  const violations: BreakViolation[] = [];

  for (const shift of shifts) {
    const grossMinutes =
      (new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / 1000 / 60;
    const required =
      grossMinutes > 8 * 60
        ? settings.minBreakMinutesOverEightHours
        : grossMinutes > 6 * 60
          ? settings.minBreakMinutesOverSixHours
          : 0;

    if (required > 0 && shift.breakMinutes < required) {
      violations.push({
        staffId: shift.staffId,
        date: shiftDate(shift),
        workedMinutes: grossMinutes,
        breakMinutes: shift.breakMinutes,
        requiredBreakMinutes: required,
      });
    }
  }

  return violations;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = map.get(k);
    if (group) group.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / msPerDay);
}

function isoWeekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
