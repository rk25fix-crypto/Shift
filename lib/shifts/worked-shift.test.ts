import { describe, expect, it } from "vitest";
import { toWorkedShifts, type ShiftTypeTiming } from "@/lib/shifts/worked-shift";
import type { Assignment } from "@/lib/shifts/queries";

const EARLY: ShiftTypeTiming = {
  id: "early",
  startTime: "07:00",
  endTime: "16:00",
  crossesMidnight: false,
  breakMinutes: 60,
};

const NIGHT: ShiftTypeTiming = {
  id: "night",
  startTime: "22:00",
  endTime: "07:00",
  crossesMidnight: true,
  breakMinutes: 60,
};

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "a1",
    staffId: "s1",
    shiftTypeId: "early",
    date: "2026-06-01",
    status: "confirmed",
    actualStartTime: null,
    actualEndTime: null,
    ...overrides,
  };
}

describe("toWorkedShifts", () => {
  it("resolves a same-day shift's start/end from the shift type's times", () => {
    const shiftTypesById = new Map([[EARLY.id, EARLY]]);
    const result = toWorkedShifts([assignment()], shiftTypesById);

    expect(result).toEqual([
      {
        staffId: "s1",
        startsAt: "2026-06-01T07:00:00Z",
        endsAt: "2026-06-01T16:00:00Z",
        breakMinutes: 60,
      },
    ]);
  });

  it("rolls the end date forward by one day for a crossesMidnight shift type", () => {
    const shiftTypesById = new Map([[NIGHT.id, NIGHT]]);
    const result = toWorkedShifts([assignment({ shiftTypeId: "night" })], shiftTypesById);

    expect(result).toEqual([
      {
        staffId: "s1",
        startsAt: "2026-06-01T22:00:00Z",
        endsAt: "2026-06-02T07:00:00Z",
        breakMinutes: 60,
      },
    ]);
  });

  it("skips an assignment whose shift type no longer exists", () => {
    const result = toWorkedShifts([assignment({ shiftTypeId: "deleted-type" })], new Map());
    expect(result).toEqual([]);
  });

  it("prefers actualStartTime/actualEndTime over the shift type's scheduled times when both are recorded", () => {
    const shiftTypesById = new Map([[EARLY.id, EARLY]]);
    const result = toWorkedShifts(
      [assignment({ actualStartTime: "07:15", actualEndTime: "15:30" })],
      shiftTypesById,
    );

    expect(result).toEqual([
      {
        staffId: "s1",
        startsAt: "2026-06-01T07:15:00Z",
        endsAt: "2026-06-01T15:30:00Z",
        breakMinutes: 60,
      },
    ]);
  });

  it("still rolls the end date forward for a crossesMidnight shift type even with a recorded actual end time", () => {
    const shiftTypesById = new Map([[NIGHT.id, NIGHT]]);
    const result = toWorkedShifts(
      [assignment({ shiftTypeId: "night", actualStartTime: "22:10", actualEndTime: "06:45" })],
      shiftTypesById,
    );

    expect(result).toEqual([
      {
        staffId: "s1",
        startsAt: "2026-06-01T22:10:00Z",
        endsAt: "2026-06-02T06:45:00Z",
        breakMinutes: 60,
      },
    ]);
  });

  it("falls back to the scheduled time when only one of actualStartTime/actualEndTime is recorded", () => {
    const shiftTypesById = new Map([[EARLY.id, EARLY]]);
    const result = toWorkedShifts([assignment({ actualStartTime: "07:15" })], shiftTypesById);

    expect(result[0]).toMatchObject({ startsAt: "2026-06-01T07:15:00Z", endsAt: "2026-06-01T16:00:00Z" });
  });

  it("converts multiple assignments in order", () => {
    const shiftTypesById = new Map([[EARLY.id, EARLY]]);
    const result = toWorkedShifts(
      [
        assignment({ id: "a1", staffId: "s1", date: "2026-06-01" }),
        assignment({ id: "a2", staffId: "s2", date: "2026-06-02" }),
      ],
      shiftTypesById,
    );

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.staffId)).toEqual(["s1", "s2"]);
  });
});
