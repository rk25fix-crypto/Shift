/**
 * Pure date helpers. Dates are always ISO strings (YYYY-MM-DD) and month
 * keys are YYYY-MM, matching the `date` columns in supabase/migrations.
 *
 * organizations.timezone defaults to Asia/Tokyo (supabase/migrations/0001_init.sql)
 * and Phase 1a has no UI to change it yet, so DEFAULT_TIMEZONE stands in for
 * that column until Phase 1b's org settings screen reads it from the DB.
 */

export const DEFAULT_TIMEZONE = "Asia/Tokyo";

const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function todayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the ISO date shape we store.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-30). */
export function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateJapanese(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${JP_WEEKDAYS[d.getUTCDay()]})`;
}

/** YYYY-MM for the given date, defaulting to today. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The Monday (YYYY-MM-DD) starting the ISO week (Mon-Sun) containing `date`. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/** The 7 ISO dates (YYYY-MM-DD) of the week starting on `monday`, in order. */
export function datesInWeek(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** All ISO dates (YYYY-MM-DD) in `[startDate, endDateExclusive)`, in order. */
export function datesInRange(startDate: string, endDateExclusive: string): string[] {
  const dates: string[] = [];
  for (let d = startDate; d < endDateExclusive; d = addDays(d, 1)) {
    dates.push(d);
  }
  return dates;
}

/** All ISO dates (YYYY-MM-DD) in the given YYYY-MM month, in order. */
export function datesInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${yearMonth}-${day}`;
  });
}

/** The YYYY-MM immediately after the given one, e.g. for exclusive date-range queries. */
export function nextMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(year, month, 1)); // month is 1-based here, so this rolls forward one month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
