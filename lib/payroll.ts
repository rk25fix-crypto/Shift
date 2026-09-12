/**
 * Payroll estimate: worked hours × hourly wage, plus a simplified premium
 * model for 深夜(late-night)・残業(overtime)・法定休日(legal holiday) work.
 *
 * This is deliberately an ESTIMATE, not a payroll-compliance engine — see
 * PayrollEstimate.tsx's disclaimer and docs/plan.md's "労基法違反という表現
 * はUI上使わない" policy. Two simplifications worth knowing about before
 * trusting a number from this module:
 *
 *   - 法定休日 (the one mandatory rest day per week) is assumed to be every
 *     Sunday. Real labor law lets an employer designate any day, and only
 *     requires *a* rest day exist each week, not that it always fall on a
 *     fixed weekday — this module has no such per-org setting to read yet.
 *   - When overtime hours must be attributed to specific shifts (to know
 *     which hours also cross into the night-premium window), this module
 *     picks the most recent shifts in the week/day first. A real payroll
 *     system would use actual punch times; this estimate only has one
 *     shift-type-derived time range per day to work with.
 *
 * The org's own `maxWeeklyHours` setting (lib/labor-rules.ts) is a
 * SEPARATE, unrelated concept — an internal "flag this for review"
 * threshold a manager configures for themselves. The statutory overtime
 * trigger used here (8h/day, 40h/week) is fixed by law and not read from
 * that setting.
 */
import { isoWeekKey, workedHours, type WorkedShift } from "@/lib/labor-rules";

const NIGHT_START_HOUR = 22; // 22:00
const NIGHT_END_HOUR = 5; // 05:00 the next day
const NIGHT_PREMIUM_RATE = 0.25;
const DAILY_OVERTIME_THRESHOLD_HOURS = 8;
const WEEKLY_OVERTIME_THRESHOLD_HOURS = 40;
const OVERTIME_PREMIUM_RATE = 0.25;
const HOLIDAY_PREMIUM_RATE = 0.35;
const LEGAL_HOLIDAY_WEEKDAY = 0; // Sunday

export interface PayrollPremiumBreakdown {
  /** Hours worked inside 22:00-5:00, counted regardless of whether they're also overtime or holiday hours. */
  nightHours: number;
  /** Hours beyond the statutory 8h/day or 40h/week thresholds (holiday hours are never double-counted as overtime here). */
  overtimeHours: number;
  /** Hours worked on the assumed legal holiday (Sunday). */
  holidayHours: number;
}

export interface PayrollEstimate {
  totalHours: number;
  estimatedPay: number;
  premiums: PayrollPremiumBreakdown;
}

interface ShiftBreakdown {
  date: string;
  netHours: number;
  /** Portion of netHours that falls inside the 22:00-5:00 window, proportionally allocated across the break the same way netHours itself is derived from gross time. */
  netNightHours: number;
  isHoliday: boolean;
}

export function estimatePayroll(shifts: WorkedShift[], hourlyWage: number): PayrollEstimate {
  const breakdowns = shifts.map(toShiftBreakdown).sort((a, b) => (a.date < b.date ? -1 : 1));
  const overtimeByShift = attributeOvertime(breakdowns);

  let pay = 0;
  let totalHours = 0;
  let nightHoursTotal = 0;
  let overtimeHoursTotal = 0;
  let holidayHoursTotal = 0;

  for (const b of breakdowns) {
    totalHours += b.netHours;
    nightHoursTotal += b.netNightHours;

    if (b.isHoliday) {
      holidayHoursTotal += b.netHours;
      const nightPortion = b.netNightHours;
      const dayPortion = b.netHours - nightPortion;
      pay += dayPortion * hourlyWage * (1 + HOLIDAY_PREMIUM_RATE);
      pay += nightPortion * hourlyWage * (1 + HOLIDAY_PREMIUM_RATE + NIGHT_PREMIUM_RATE);
      continue;
    }

    const overtimeHours = overtimeByShift.get(b) ?? 0;
    overtimeHoursTotal += overtimeHours;

    // Overtime hours are assumed to share the same night/day mix as the
    // rest of the shift — there's no finer-grained data to say otherwise.
    const nightFraction = b.netHours > 0 ? b.netNightHours / b.netHours : 0;
    const overtimeNightHours = overtimeHours * nightFraction;
    const overtimeDayHours = overtimeHours - overtimeNightHours;
    const regularNightHours = b.netNightHours - overtimeNightHours;
    const regularDayHours = b.netHours - b.netNightHours - overtimeDayHours;

    pay += regularDayHours * hourlyWage;
    pay += regularNightHours * hourlyWage * (1 + NIGHT_PREMIUM_RATE);
    pay += overtimeDayHours * hourlyWage * (1 + OVERTIME_PREMIUM_RATE);
    pay += overtimeNightHours * hourlyWage * (1 + OVERTIME_PREMIUM_RATE + NIGHT_PREMIUM_RATE);
  }

  return {
    totalHours: round1(totalHours),
    estimatedPay: Math.round(pay),
    premiums: {
      nightHours: round1(nightHoursTotal),
      overtimeHours: round1(overtimeHoursTotal),
      holidayHours: round1(holidayHoursTotal),
    },
  };
}

function toShiftBreakdown(shift: WorkedShift): ShiftBreakdown {
  const date = shift.startsAt.slice(0, 10);
  const netHours = workedHours(shift);
  const grossHours =
    (new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / 1000 / 60 / 60;
  const nightGrossHours = nightOverlapHours(shift.startsAt, shift.endsAt);
  // The break's exact timing isn't tracked (only its duration), so its
  // reduction from gross to net hours is spread across day/night
  // proportionally to how much of the gross shift each represents.
  const nightFractionOfGross = grossHours > 0 ? nightGrossHours / grossHours : 0;
  const netNightHours = netHours * nightFractionOfGross;
  const isHoliday = weekdayOf(date) === LEGAL_HOLIDAY_WEEKDAY;

  return { date, netHours, netNightHours, isHoliday };
}

/** Hours of overlap between [startsAt, endsAt) and every 22:00-5:00 window it passes through. */
function nightOverlapHours(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  let overlapMs = 0;

  // Walk one calendar day at a time across the shift's span, starting one
  // day before the shift's own start date — a shift that starts inside
  // 00:00-05:00 overlaps the night window that BEGAN THE PREVIOUS EVENING
  // (D-1 22:00 to D 05:00), which starting the walk at the shift's own date
  // would never construct at all (regression: a 03:00-11:00 shift used to
  // come back with 0 night hours instead of 2). The Math.max(0, ...) clamp
  // below makes the extra leading day a harmless no-op for shifts starting
  // after 05:00.
  const cursor = new Date(startsAt);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (cursor.getTime() < end) {
    const nightStart = new Date(cursor);
    nightStart.setUTCHours(NIGHT_START_HOUR, 0, 0, 0);
    const nightEnd = new Date(cursor);
    nightEnd.setUTCDate(nightEnd.getUTCDate() + 1);
    nightEnd.setUTCHours(NIGHT_END_HOUR, 0, 0, 0);

    const overlapStart = Math.max(start, nightStart.getTime());
    const overlapEnd = Math.min(end, nightEnd.getTime());
    overlapMs += Math.max(0, overlapEnd - overlapStart);

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return overlapMs / 1000 / 60 / 60;
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * Attributes statutory overtime (hours beyond 8/day or 40/week, whichever
 * applies) to specific shifts. Legal-holiday shifts are excluded entirely —
 * they get the holiday premium instead and don't count toward either
 * threshold. Within a week, hours beyond 40 are attributed to the most
 * recent shifts first (see this module's docstring on why).
 */
function attributeOvertime(breakdowns: ShiftBreakdown[]): Map<ShiftBreakdown, number> {
  const overtimeByShift = new Map<ShiftBreakdown, number>();
  const regularPortion = new Map<ShiftBreakdown, number>();

  for (const b of breakdowns) {
    if (b.isHoliday) continue;
    const dailyOvertime = Math.max(0, b.netHours - DAILY_OVERTIME_THRESHOLD_HOURS);
    overtimeByShift.set(b, dailyOvertime);
    regularPortion.set(b, b.netHours - dailyOvertime);
  }

  const byWeek = new Map<string, ShiftBreakdown[]>();
  for (const b of breakdowns) {
    if (b.isHoliday) continue;
    const week = isoWeekKey(b.date);
    const group = byWeek.get(week);
    if (group) group.push(b);
    else byWeek.set(week, [b]);
  }

  for (const weekShifts of byWeek.values()) {
    const weeklyRegularTotal = weekShifts.reduce((sum, b) => sum + (regularPortion.get(b) ?? 0), 0);
    let remainingWeeklyOvertime = Math.max(0, weeklyRegularTotal - WEEKLY_OVERTIME_THRESHOLD_HOURS);
    if (remainingWeeklyOvertime === 0) continue;

    const mostRecentFirst = [...weekShifts].sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const b of mostRecentFirst) {
      if (remainingWeeklyOvertime <= 0) break;
      const available = regularPortion.get(b) ?? 0;
      const attributed = Math.min(available, remainingWeeklyOvertime);
      if (attributed > 0) {
        overtimeByShift.set(b, (overtimeByShift.get(b) ?? 0) + attributed);
        remainingWeeklyOvertime -= attributed;
      }
    }
  }

  return overtimeByShift;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
