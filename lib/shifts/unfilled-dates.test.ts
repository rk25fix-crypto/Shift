import { describe, expect, it } from "vitest";
import { computeUnfilledDates } from "@/lib/shifts/unfilled-dates";

describe("computeUnfilledDates", () => {
  it("flags a date where a required shift type has fewer assignments than requiredCount", () => {
    const result = computeUnfilledDates(
      ["2026-06-01"],
      [{ id: "early", requiredCount: 2 }],
      [{ date: "2026-06-01", shiftTypeId: "early" }], // only 1 of 2 needed
    );
    expect(result).toEqual(new Set(["2026-06-01"]));
  });

  it("does not flag a date that meets requiredCount exactly", () => {
    const result = computeUnfilledDates(
      ["2026-06-01"],
      [{ id: "early", requiredCount: 2 }],
      [
        { date: "2026-06-01", shiftTypeId: "early" },
        { date: "2026-06-01", shiftTypeId: "early" },
      ],
    );
    expect(result).toEqual(new Set());
  });

  it("flags a date if ANY required shift type is short, even when others are fully staffed", () => {
    const result = computeUnfilledDates(
      ["2026-06-01"],
      [
        { id: "early", requiredCount: 1 },
        { id: "late", requiredCount: 1 },
      ],
      [{ date: "2026-06-01", shiftTypeId: "early" }], // "late" has zero
    );
    expect(result).toEqual(new Set(["2026-06-01"]));
  });

  it("does not flag any date when there are no required shift types", () => {
    expect(computeUnfilledDates(["2026-06-01", "2026-06-02"], [], [])).toEqual(new Set());
  });

  it("ignores assignments for shift types that aren't in the required list", () => {
    const result = computeUnfilledDates(
      ["2026-06-01"],
      [{ id: "early", requiredCount: 1 }],
      [{ date: "2026-06-01", shiftTypeId: "unrelated" }],
    );
    expect(result).toEqual(new Set(["2026-06-01"]));
  });

  it("flags every date with no assignments at all when a shift type is required", () => {
    const dates = ["2026-06-01", "2026-06-02", "2026-06-03"];
    const result = computeUnfilledDates(dates, [{ id: "early", requiredCount: 1 }], []);
    expect(result).toEqual(new Set(dates));
  });

  it("checks each date independently — a fully-staffed date doesn't mask a short-staffed one", () => {
    const dates = ["2026-06-01", "2026-06-02"];
    const result = computeUnfilledDates(
      dates,
      [{ id: "early", requiredCount: 1 }],
      [{ date: "2026-06-01", shiftTypeId: "early" }], // only 06-01 is covered
    );
    expect(result).toEqual(new Set(["2026-06-02"]));
  });
});
