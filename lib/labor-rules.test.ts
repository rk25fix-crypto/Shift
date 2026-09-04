import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORK_RULE_SETTINGS,
  detectBreakViolations,
  detectConsecutiveDayViolations,
  detectHoursViolations,
  type WorkedShift,
} from "@/lib/labor-rules";

function shift(
  staffId: string,
  date: string,
  startHour: number,
  endHour: number,
  breakMinutes = 60,
): WorkedShift {
  return {
    staffId,
    startsAt: `${date}T${String(startHour).padStart(2, "0")}:00:00Z`,
    endsAt: `${date}T${String(endHour).padStart(2, "0")}:00:00Z`,
    breakMinutes,
  };
}

describe("detectConsecutiveDayViolations", () => {
  it("flags a run longer than the configured limit", () => {
    const dates = ["01", "02", "03", "04", "05", "06", "07"].map(
      (d) => `2026-06-${d}`,
    );
    const shifts = dates.map((d) => shift("s1", d, 9, 17));

    const violations = detectConsecutiveDayViolations(shifts, {
      ...DEFAULT_WORK_RULE_SETTINGS,
      maxConsecutiveDays: 6,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      staffId: "s1",
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      consecutiveDays: 7,
    });
  });

  it("does not flag a run at or under the limit", () => {
    const dates = ["01", "02", "03", "04", "05", "06"].map((d) => `2026-06-${d}`);
    const shifts = dates.map((d) => shift("s1", d, 9, 17));

    expect(detectConsecutiveDayViolations(shifts)).toHaveLength(0);
  });

  it("detects a run that started in the previous month, given lookback data", () => {
    // Worked May 28 - Jun 3 (7 days) — must be caught even though the run
    // crosses a calendar-month boundary (docs/plan.md callout: "月をまたぐ
    // 連勤の検出").
    const dates = [
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ];
    const shifts = dates.map((d) => shift("s1", d, 9, 17));

    const violations = detectConsecutiveDayViolations(shifts, {
      ...DEFAULT_WORK_RULE_SETTINGS,
      maxConsecutiveDays: 6,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0].consecutiveDays).toBe(7);
  });

  it("resets the streak after a day off", () => {
    // Without the gap on 06-03, 06-01..06-04 would be a 4-day run exceeding
    // a limit of 2; the gap must split it into two 2-day runs, neither of
    // which violates the limit.
    const shifts = [
      shift("s1", "2026-06-01", 9, 17),
      shift("s1", "2026-06-02", 9, 17),
      // gap on 06-03
      shift("s1", "2026-06-04", 9, 17),
      shift("s1", "2026-06-05", 9, 17),
    ];

    expect(
      detectConsecutiveDayViolations(shifts, {
        ...DEFAULT_WORK_RULE_SETTINGS,
        maxConsecutiveDays: 2,
      }),
    ).toHaveLength(0);
  });

  it("tracks separate staff independently", () => {
    const dates = ["01", "02", "03", "04", "05", "06", "07"].map(
      (d) => `2026-06-${d}`,
    );
    const shifts = [
      ...dates.map((d) => shift("s1", d, 9, 17)),
      shift("s2", "2026-06-01", 9, 17),
    ];

    const violations = detectConsecutiveDayViolations(shifts, {
      ...DEFAULT_WORK_RULE_SETTINGS,
      maxConsecutiveDays: 6,
    });

    expect(violations.map((v) => v.staffId)).toEqual(["s1"]);
  });
});

describe("detectHoursViolations", () => {
  it("flags a month whose total worked hours exceed the limit", () => {
    // 20 days x 9h (10h gross - 1h break) = 180h > 160h default limit.
    const shifts = Array.from({ length: 20 }, (_, i) =>
      shift("s1", `2026-06-${String(i + 1).padStart(2, "0")}`, 9, 19, 60),
    );

    const violations = detectHoursViolations(shifts).filter((v) => v.period === "month");
    expect(violations).toHaveLength(1);
    expect(violations[0].totalHours).toBe(180);
    expect(violations[0].limitHours).toBe(160);
  });

  it("flags a week whose total worked hours exceed the limit", () => {
    // 2026-06-01 is a Monday.
    const shifts = ["01", "02", "03", "04", "05"].map((d) =>
      shift("s1", `2026-06-${d}`, 8, 18, 0),
    ); // 5 x 10h = 50h > 40h default weekly limit

    const violations = detectHoursViolations(shifts).filter((v) => v.period === "week");
    expect(violations).toHaveLength(1);
    expect(violations[0].totalHours).toBe(50);
  });

  it("does not flag hours within the limit", () => {
    const shifts = ["01", "02", "03"].map((d) => shift("s1", `2026-06-${d}`, 9, 17, 60));
    expect(detectHoursViolations(shifts)).toHaveLength(0);
  });
});

describe("detectBreakViolations", () => {
  it("flags a shift over 8h with a break shorter than the required minimum", () => {
    const s = shift("s1", "2026-06-01", 9, 19, 30); // 10h gross, only 30min break
    expect(detectBreakViolations([s])).toHaveLength(1);
  });

  it("does not flag a shift with an adequate break", () => {
    const s = shift("s1", "2026-06-01", 9, 19, 60); // 10h gross, 60min break
    expect(detectBreakViolations([s])).toHaveLength(0);
  });

  it("does not require a break for a short shift", () => {
    const s = shift("s1", "2026-06-01", 9, 14, 0); // 5h gross, no break required
    expect(detectBreakViolations([s])).toHaveLength(0);
  });
});
