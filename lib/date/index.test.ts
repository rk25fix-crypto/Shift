import { describe, expect, it } from "vitest";
import { addDays, datesInMonth, formatDateJapanese, monthOf, nextMonth } from "@/lib/date";

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

describe("nextMonth", () => {
  it("rolls forward within a year", () => {
    expect(nextMonth("2026-06")).toBe("2026-07");
  });

  it("rolls over into the next year", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});
