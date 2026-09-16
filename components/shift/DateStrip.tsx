import Link from "next/link";

const JP_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface DateStripProps {
  dates: string[];
  selectedDate: string;
  /** Dates with enough staff assigned to every required shift type (lib/shifts/unfilled-dates.ts の逆)。 */
  filledDates: Set<string>;
}

/** 7-column week strip on the home screen — tap a day to jump without leaving /today (design handoff 1b). */
export function DateStrip({ dates, selectedDate, filledDates }: DateStripProps) {
  return (
    <div className="grid grid-cols-7 gap-1.5 px-4">
      {dates.map((date) => {
        const d = new Date(`${date}T00:00:00Z`);
        const weekday = d.getUTCDay();
        const isSelected = date === selectedDate;
        const isWeekend = weekday === 0 || weekday === 6;
        return (
          <Link
            key={date}
            href={`/today?date=${date}`}
            className="flex flex-col items-center gap-1 rounded-[14px] py-2 text-center"
            style={
              isSelected
                ? { background: "var(--color-primary)", color: "#fff" }
                : { color: "var(--color-ink)" }
            }
          >
            <span className="text-[10px]" style={!isSelected ? { color: "var(--color-ink-weakest)" } : undefined}>
              {JP_WEEKDAYS[weekday]}
            </span>
            <span className="text-base font-bold font-heading">{d.getUTCDate()}</span>
            <span
              aria-hidden
              className="h-[5px] w-[5px] rounded-full"
              style={{
                background: isSelected
                  ? "#fff"
                  : filledDates.has(date)
                    ? "var(--color-success-strong)"
                    : isWeekend
                      ? "var(--color-border)"
                      : "transparent",
              }}
            />
          </Link>
        );
      })}
    </div>
  );
}
