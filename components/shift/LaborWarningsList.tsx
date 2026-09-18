import type { LaborWarnings } from "@/lib/shifts/labor-warnings";

function shortDate(date: string): string {
  return date.slice(5).replace("-", "/");
}

interface LaborWarningsListProps {
  warnings: LaborWarnings;
  /** When provided, each line is prefixed with the staff member's name (week view, multiple staff). Omitted on the single-staff detail page. */
  staffNameById?: Map<string, string>;
}

/**
 * Renders lib/labor-rules.ts's violations as plain-language warnings. Never
 * says "労基法違反" — these are org-configurable thresholds, not a
 * restatement of the Labor Standards Act (docs/plan.md, "iPhone向けUIの核心方針").
 */
export function LaborWarningsList({ warnings, staffNameById }: LaborWarningsListProps) {
  const items: string[] = [];

  for (const v of warnings.consecutiveDayViolations) {
    const prefix = staffNameById?.get(v.staffId);
    items.push(
      `${prefix ? `${prefix}: ` : ""}${v.consecutiveDays}連勤(${shortDate(v.startDate)}〜${shortDate(v.endDate)})`,
    );
  }
  for (const v of warnings.hoursViolations) {
    const prefix = staffNameById?.get(v.staffId);
    const periodLabel = v.period === "week" ? "週の" : "月の";
    items.push(
      `${prefix ? `${prefix}: ` : ""}${periodLabel}上限時間超過(${v.totalHours}時間 / 上限${v.limitHours}時間)`,
    );
  }
  for (const v of warnings.breakViolations) {
    const prefix = staffNameById?.get(v.staffId);
    items.push(
      `${prefix ? `${prefix}: ` : ""}${shortDate(v.date)} 休憩不足(${v.breakMinutes}分 / 必要${v.requiredBreakMinutes}分)`,
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mx-4 flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-800">勤務ルール警告</p>
      <ul className="flex flex-col gap-1 text-sm text-amber-700">
        {items.map((item, i) => (
          <li key={i}>⚠ {item}</li>
        ))}
      </ul>
    </div>
  );
}
