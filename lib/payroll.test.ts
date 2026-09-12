import { describe, expect, it } from "vitest";
import { estimatePayroll } from "@/lib/payroll";
import type { WorkedShift } from "@/lib/labor-rules";

const NO_PREMIUMS = { nightHours: 0, overtimeHours: 0, holidayHours: 0 };

/** startHour/endHour are same-day hours on a Mon-Sat date by default — pass a Sunday date to get the assumed 法定休日. */
function shift(
  startHour: number,
  endHour: number,
  breakMinutes = 60,
  date = "2026-06-01", // Monday
): WorkedShift {
  return {
    staffId: "s1",
    startsAt: `${date}T${String(startHour).padStart(2, "0")}:00:00Z`,
    endsAt: `${date}T${String(endHour).padStart(2, "0")}:00:00Z`,
    breakMinutes,
  };
}

describe("estimatePayroll", () => {
  it("multiplies total worked hours by the hourly wage when no premium applies", () => {
    const shifts = [shift(9, 18, 60)]; // 9h gross - 1h break = 8h, at (not over) the daily overtime threshold
    expect(estimatePayroll(shifts, 1000)).toEqual({
      totalHours: 8,
      estimatedPay: 8000,
      premiums: NO_PREMIUMS,
    });
  });

  it("sums hours across multiple shifts", () => {
    const shifts = [shift(9, 17, 60, "2026-06-01"), shift(9, 17, 60, "2026-06-02")]; // 7h + 7h, Mon+Tue
    expect(estimatePayroll(shifts, 1200)).toEqual({
      totalHours: 14,
      estimatedPay: 16800,
      premiums: NO_PREMIUMS,
    });
  });

  it("rounds the estimated pay to the nearest yen without double-rounding the hours first", () => {
    const shifts = [shift(9, 12, 20)]; // 3h gross - 20min break = 2.6667h
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBeCloseTo(2.7, 5);
    expect(result.estimatedPay).toBe(2667); // 2.6667h * 1000 = 2666.67 -> rounds to 2667, not 2700
    expect(result.premiums).toEqual(NO_PREMIUMS);
  });

  it("returns zero for a staff member with no shifts this period", () => {
    expect(estimatePayroll([], 1000)).toEqual({
      totalHours: 0,
      estimatedPay: 0,
      premiums: NO_PREMIUMS,
    });
  });

  it("applies the 25% night premium to hours inside 22:00-5:00, including across midnight", () => {
    const shifts: WorkedShift[] = [
      { staffId: "s1", startsAt: "2026-06-01T22:00:00Z", endsAt: "2026-06-02T02:00:00Z", breakMinutes: 0 },
    ];
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBe(4);
    expect(result.estimatedPay).toBe(5000); // 4h x 1000 x 1.25
    expect(result.premiums).toEqual({ nightHours: 4, overtimeHours: 0, holidayHours: 0 });
  });

  it("applies the night premium to a shift starting inside 00:00-5:00 (regression: the walk used to start on the shift's own date, missing the window that began the previous evening)", () => {
    const shifts = [shift(3, 11, 0)]; // 03:00-11:00, no break -> 8h net, 2h (03:00-05:00) inside the night window
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBe(8);
    expect(result.estimatedPay).toBe(8500); // 6h x 1000 + 2h x 1000 x 1.25
    expect(result.premiums).toEqual({ nightHours: 2, overtimeHours: 0, holidayHours: 0 });
  });

  it("applies the 25% overtime premium to hours beyond 8h in a single shift", () => {
    const shifts = [shift(9, 19, 0)]; // 10h gross, no break -> 10h net, 2h over the daily threshold
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBe(10);
    expect(result.estimatedPay).toBe(10500); // 8h x 1000 + 2h x 1000 x 1.25
    expect(result.premiums).toEqual({ nightHours: 0, overtimeHours: 2, holidayHours: 0 });
  });

  it("applies the 25% overtime premium to hours beyond 40h/week, attributed to the most recent shifts", () => {
    // Six 7h shifts (Mon-Sat, none individually over 8h) = 42h, 2h over the weekly threshold.
    const shifts = ["01", "02", "03", "04", "05", "06"].map((day) => shift(9, 16, 0, `2026-06-${day}`));
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBe(42);
    // Saturday (06-06, the most recent day) absorbs the 2h of weekly overtime;
    // the other 5 days x 7h stay regular: 5*7*1000 + (5*1000 + 2*1000*1.25).
    expect(result.estimatedPay).toBe(35000 + 5000 + 2500);
    expect(result.premiums).toEqual({ nightHours: 0, overtimeHours: 2, holidayHours: 0 });
  });

  it("applies the 35% legal-holiday premium on the assumed holiday (Sunday), with no separate overtime stacking", () => {
    const shifts = [shift(9, 17, 0, "2026-06-07")]; // Sunday, 8h net — would otherwise sit at the daily OT threshold
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBe(8);
    expect(result.estimatedPay).toBe(10800); // 8h x 1000 x 1.35
    expect(result.premiums).toEqual({ nightHours: 0, overtimeHours: 0, holidayHours: 8 });
  });

  it("stacks the night and legal-holiday premiums (1.60x) rather than picking just one", () => {
    const shifts: WorkedShift[] = [
      // Sunday 22:00 -> Monday 03:00: starts on the assumed holiday.
      { staffId: "s1", startsAt: "2026-06-07T22:00:00Z", endsAt: "2026-06-08T03:00:00Z", breakMinutes: 0 },
    ];
    const result = estimatePayroll(shifts, 1000);
    expect(result.totalHours).toBe(5);
    expect(result.estimatedPay).toBe(8000); // 5h x 1000 x (1 + 0.35 + 0.25)
    expect(result.premiums).toEqual({ nightHours: 5, overtimeHours: 0, holidayHours: 5 });
  });
});
