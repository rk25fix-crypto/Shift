import { describe, expect, it } from "vitest";
import { generateShifts, type GeneratorShiftType, type GeneratorStaff } from "@/lib/shift-generator";

const EARLY: GeneratorShiftType = { id: "early", isRequired: true, isBalanced: true };
const LATE: GeneratorShiftType = { id: "late", isRequired: true, isBalanced: true };

const ALICE: GeneratorStaff = { id: "alice", fixedDaysOff: [], unavailableShiftTypeIds: [] };
const BOB: GeneratorStaff = { id: "bob", fixedDaysOff: [], unavailableShiftTypeIds: [] };
const CAROL: GeneratorStaff = { id: "carol", fixedDaysOff: [], unavailableShiftTypeIds: [] };

describe("generateShifts", () => {
  it("fills every required shift when enough eligible staff exist", () => {
    const result = generateShifts({
      staff: [ALICE, BOB, CAROL],
      shiftTypes: [EARLY, LATE],
      dates: ["2026-06-01", "2026-06-02"],
      timeOffRequests: [],
      existingAssignments: [],
    });

    expect(result.unfilledShifts).toHaveLength(0);
    expect(result.draftAssignments).toHaveLength(4); // 2 dates x 2 required shift types
  });

  it("never assigns a staff member on their fixed day off", () => {
    // 2026-06-01 is a Monday (dayOfWeek 1).
    const aliceOffMondays: GeneratorStaff = { ...ALICE, fixedDaysOff: [1] };

    const result = generateShifts({
      staff: [aliceOffMondays, BOB],
      shiftTypes: [EARLY],
      dates: ["2026-06-01"],
      timeOffRequests: [],
      existingAssignments: [],
    });

    expect(result.draftAssignments.every((a) => a.staffId !== "alice")).toBe(true);
    expect(result.draftAssignments).toEqual([{ staffId: "bob", shiftTypeId: "early", date: "2026-06-01" }]);
  });

  it("never assigns a staff member to a shift type they can't do", () => {
    const aliceNoLate: GeneratorStaff = { ...ALICE, unavailableShiftTypeIds: ["late"] };

    const result = generateShifts({
      staff: [aliceNoLate, BOB],
      shiftTypes: [LATE],
      dates: ["2026-06-01"],
      timeOffRequests: [],
      existingAssignments: [],
    });

    expect(result.draftAssignments.every((a) => a.staffId !== "alice")).toBe(true);
  });

  it("respects a requested day off", () => {
    const result = generateShifts({
      staff: [ALICE, BOB],
      shiftTypes: [EARLY],
      dates: ["2026-06-01"],
      timeOffRequests: [{ staffId: "alice", date: "2026-06-01" }],
      existingAssignments: [],
    });

    expect(result.draftAssignments).toEqual([{ staffId: "bob", shiftTypeId: "early", date: "2026-06-01" }]);
  });

  it("does not double-book a staff member already assigned that date", () => {
    // The generator keeps to one auto-assigned shift per staff per date
    // (see lib/shift-generator/index.ts docstring) — a manager can still
    // add a second shift by hand, but auto-generate must not do it for them.
    const result = generateShifts({
      staff: [ALICE, BOB],
      shiftTypes: [LATE],
      dates: ["2026-06-01"],
      timeOffRequests: [],
      existingAssignments: [{ staffId: "alice", shiftTypeId: "early", date: "2026-06-01" }],
    });

    expect(result.draftAssignments).toEqual([{ staffId: "bob", shiftTypeId: "late", date: "2026-06-01" }]);
  });

  it("reports an unfilled shift when nobody is eligible", () => {
    const aliceOffMondays: GeneratorStaff = { ...ALICE, fixedDaysOff: [1] };

    const result = generateShifts({
      staff: [aliceOffMondays],
      shiftTypes: [EARLY],
      dates: ["2026-06-01"],
      timeOffRequests: [],
      existingAssignments: [],
    });

    expect(result.draftAssignments).toHaveLength(0);
    expect(result.unfilledShifts).toEqual([
      { date: "2026-06-01", shiftTypeId: "early", reason: "no_eligible_staff" },
    ]);
  });

  it("balances workload across eligible staff over multiple days", () => {
    const result = generateShifts({
      staff: [ALICE, BOB],
      shiftTypes: [EARLY],
      dates: ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"],
      timeOffRequests: [],
      existingAssignments: [],
    });

    const counts = new Map<string, number>();
    for (const a of result.draftAssignments) {
      counts.set(a.staffId, (counts.get(a.staffId) ?? 0) + 1);
    }

    expect(counts.get("alice")).toBe(2);
    expect(counts.get("bob")).toBe(2);
  });
});
