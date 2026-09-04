/**
 * Auto-fill algorithm: given staff constraints and a date range, produces a
 * DRAFT shift schedule for the manager to review before publishing (never
 * writes directly to confirmed shift_assignments — see docs/plan.md,
 * "自動生成に status: draft を持たせる" for why).
 *
 * Pure function, runs client-side (no server round trip needed), merging
 * the two legacy prototypes' approaches: shift4.html's constraint-aware
 * rotation (respects fixed days off / unavailable shift types / labor
 * limits) plus index.html's workload-balancing goal.
 */

export interface GeneratorStaff {
  id: string;
  /** 0 = Sunday .. 6 = Saturday */
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
}

export interface GeneratorShiftType {
  id: string;
  isRequired: boolean;
  isBalanced: boolean;
}

export interface TimeOffRequest {
  staffId: string;
  date: string;
}

export interface DraftAssignment {
  staffId: string;
  shiftTypeId: string;
  date: string;
}

export interface UnfilledShift {
  date: string;
  shiftTypeId: string;
  reason: "no_eligible_staff";
}

export interface GenerateShiftsInput {
  staff: GeneratorStaff[];
  shiftTypes: GeneratorShiftType[];
  /** ISO dates (YYYY-MM-DD), in order, to generate for. */
  dates: string[];
  timeOffRequests: TimeOffRequest[];
  /** Assignments already confirmed for this range — staff holding one of these are skipped for that date. */
  existingAssignments: DraftAssignment[];
}

export interface GenerateShiftsResult {
  draftAssignments: DraftAssignment[];
  unfilledShifts: UnfilledShift[];
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * One shift per staff member per date. Multiple daily shifts are supported
 * by the data model (shift_assignments' unique key includes shift_type_id)
 * but the generator itself keeps to the simpler one-shift-a-day model both
 * prototypes used — a manager can still add a second shift by hand.
 */
export function generateShifts(input: GenerateShiftsInput): GenerateShiftsResult {
  const { staff, shiftTypes, dates, timeOffRequests, existingAssignments } = input;

  const requestedOff = new Set(
    timeOffRequests.map((r) => `${r.staffId}|${r.date}`),
  );
  const alreadyAssigned = new Set(
    existingAssignments.map((a) => `${a.staffId}|${a.date}`),
  );

  // Balance workload by always picking the least-recently/least-often used
  // eligible staff member for each balanced+required shift type.
  const assignmentCount = new Map<string, number>(staff.map((s) => [s.id, 0]));

  const draftAssignments: DraftAssignment[] = [];
  const unfilledShifts: UnfilledShift[] = [];

  const requiredTypes = shiftTypes.filter((t) => t.isRequired);

  for (const date of dates) {
    const dow = dayOfWeek(date);
    const takenToday = new Set<string>();

    for (const shiftType of requiredTypes) {
      const eligible = staff.filter((s) => {
        if (s.fixedDaysOff.includes(dow)) return false;
        if (s.unavailableShiftTypeIds.includes(shiftType.id)) return false;
        if (requestedOff.has(`${s.id}|${date}`)) return false;
        if (alreadyAssigned.has(`${s.id}|${date}`)) return false;
        if (takenToday.has(s.id)) return false;
        return true;
      });

      if (eligible.length === 0) {
        unfilledShifts.push({ date, shiftTypeId: shiftType.id, reason: "no_eligible_staff" });
        continue;
      }

      eligible.sort(
        (a, b) => (assignmentCount.get(a.id) ?? 0) - (assignmentCount.get(b.id) ?? 0),
      );
      const chosen = eligible[0];

      draftAssignments.push({ staffId: chosen.id, shiftTypeId: shiftType.id, date });
      assignmentCount.set(chosen.id, (assignmentCount.get(chosen.id) ?? 0) + 1);
      takenToday.add(chosen.id);
    }
  }

  return { draftAssignments, unfilledShifts };
}
