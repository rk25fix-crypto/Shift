import { formatDateJapanese } from "@/lib/date";
import type { Assignment } from "@/lib/shifts/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

export function StaffMonthShifts({
  assignments,
  shiftTypes,
}: {
  assignments: Assignment[];
  shiftTypes: ShiftTypeRecord[];
}) {
  if (assignments.length === 0) {
    return <p className="px-4 text-sm text-gray-500">今月の割当はまだありません。</p>;
  }

  const shiftTypeById = new Map(shiftTypes.map((s) => [s.id, s]));

  return (
    <ul className="flex flex-col divide-y divide-gray-100 px-4">
      {assignments.map((assignment) => {
        const shiftType = shiftTypeById.get(assignment.shiftTypeId);
        return (
          <li key={assignment.id} className="flex items-center justify-between py-2 text-sm">
            <span>{formatDateJapanese(assignment.date)}</span>
            <span className="font-medium">{shiftType ? `${shiftType.code} ${shiftType.name}` : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}
