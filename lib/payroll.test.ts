import { describe, expect, it } from "vitest";
import { estimatePayroll } from "@/lib/payroll";
import type { WorkedShift } from "@/lib/labor-rules";

function shift(
  startHour: number,
  endHour: number,
  breakMinutes = 60,
  date = "2026-06-01",
): WorkedShift {
  return {
    staffId: "s1",
    startsAt: `${date}T${String(startHour).padStart(2, "0")}:00:00Z`,
    endsAt: `${date}T${String(endHour).padStart(2, "0")}:00:00Z`,
    breakMinutes,
  };
}

describe("estimatePayroll", () => {
  it("multiplies total worked hours by the hourly wage", () => {
    const shifts = [shift(9, 18, 60)]; // 9h gross - 1h break = 8h
    expect(estimatePayroll(shifts, 1000)).toEqual({ totalHours: 8, estimatedPay: 8000 });
  });

  it("sums hours across multiple shifts", () => {
    const shifts = [shift(9, 17, 60, "2026-06-01"), shift(9, 17, 60, "2026-06-02")]; // 7h + 7h
    expect(estimatePayroll(shifts, 1200)).toEqual({ totalHours: 14, estimatedPay: 16800 });
  });

  it("rounds the estimated pay to the nearest yen without double-rounding the hours first", () => {
    const shifts = [shift(9, 12, 20)]; // 3h gross - 20min break = 2.6667h
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBeCloseTo(2.7, 5);
    expect(result.estimatedPay).toBe(2667); // 2.6667h * 1000 = 2666.67 -> rounds to 2667, not 2700
  });

  it("returns zero for a staff member with no shifts this period", () => {
    expect(estimatePayroll([], 1000)).toEqual({ totalHours: 0, estimatedPay: 0 });
  });
});
