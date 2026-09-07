import { describe, expect, it } from "vitest";
import {
  addDays,
  datesInMonth,
  datesInRange,
  datesInWeek,
  formatDateJapanese,
  isValidIsoDate,
  mondayOf,
  monthOf,
  nextMonth,
} from "@/lib/date";

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-06-01", 1)).toBe("2026-06-02");
  });

  it("rolls over a month boundary", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });

  it("subtracts days", () => {
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
  });
});

describe("formatDateJapanese", () => {
  it("formats with the Japanese weekday", () => {
    // 2026-06-01 is a Monday.
    expect(formatDateJapanese("2026-06-01")).toBe("6月1日(月)");
  });
});

describe("monthOf", () => {
  it("extracts YYYY-MM", () => {
    expect(monthOf("2026-06-15")).toBe("2026-06");
  });
});

describe("datesInMonth", () => {
  it("lists every date in a 30-day month", () => {
    const dates = datesInMonth("2026-06");
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-06-01");
    expect(dates[29]).toBe("2026-06-30");
  });

  it("handles February in a leap year", () => {
    expect(datesInMonth("2028-02")).toHaveLength(29);
  });

  it("handles February in a non-leap year", () => {
    expect(datesInMonth("2026-02")).toHaveLength(28);
  });
});

describe("isValidIsoDate", () => {
  it("accepts a real date", () => {
    expect(isValidIsoDate("2026-06-01")).toBe(true);
  });

  it("accepts a leap-day date in a leap year", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects a nonexistent day of month", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
  });

  it("rejects a nonexistent month", () => {
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });

  it("rejects garbage input", () => {
    expect(isValidIsoDate("not-a-date")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("mondayOf", () => {
  it("returns the same date when it's already a Monday", () => {
    // 2026-06-01 is a Monday.
    expect(mondayOf("2026-06-01")).toBe("2026-06-01");
  });

  it("rolls back to Monday from mid-week", () => {
    expect(mondayOf("2026-06-04")).toBe("2026-06-01");
  });

  it("rolls back to Monday from Sunday", () => {
    expect(mondayOf("2026-06-07")).toBe("2026-06-01");
  });

  it("rolls back across a month boundary", () => {
    expect(mondayOf("2026-07-01")).toBe("2026-06-29");
  });
});

describe("datesInWeek", () => {
  it("lists all 7 dates starting from Monday", () => {
    expect(datesInWeek("2026-06-01")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
  });
});

describe("datesInRange", () => {
  it("lists all dates in a half-open range", () => {
    expect(datesInRange("2026-06-01", "2026-06-04")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
  });

  it("returns an empty array when start equals end", () => {
    expect(datesInRange("2026-06-01", "2026-06-01")).toEqual([]);
  });

  it("crosses a month boundary", () => {
    expect(datesInRange("2026-06-29", "2026-07-02")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
    ]);
  });
});

describe("nextMonth", () => {
  it("rolls forward within a year", () => {
    expect(nextMonth("2026-06")).toBe("2026-07");
  });

  it("rolls over into the next year", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});
