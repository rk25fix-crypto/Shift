/**
 * Which dates in a range don't yet have enough staff assigned to a required
 * shift type — the same "required slots per day" counting rule
 * lib/shift-generator/index.ts uses internally (alreadyFilledCount), but
 * applied to the CURRENT grid (confirmed + draft assignments) rather than
 * only during a generate run, so a manager can see it just by looking at
 * the week view instead of re-running "自動生成" to find out.
 */
export interface RequiredShiftType {
  id: string;
  requiredCount: number;
}

export interface DatedAssignment {
  date: string;
  shiftTypeId: string;
}

export function computeUnfilledDates(
  dates: string[],
  requiredShiftTypes: RequiredShiftType[],
  assignments: DatedAssignment[],
): Set<string> {
  if (requiredShiftTypes.length === 0) return new Set();

  const countByDateAndType = new Map<string, number>();
  for (const a of assignments) {
    const key = `${a.date}|${a.shiftTypeId}`;
    countByDateAndType.set(key, (countByDateAndType.get(key) ?? 0) + 1);
  }

  const unfilled = new Set<string>();
  for (const date of dates) {
    for (const shiftType of requiredShiftTypes) {
      const count = countByDateAndType.get(`${date}|${shiftType.id}`) ?? 0;
      if (count < shiftType.requiredCount) {
        unfilled.add(date);
        break;
      }
    }
  }
  return unfilled;
}
