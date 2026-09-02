"use client";

import { useState } from "react";
import type { StaffRecord } from "@/lib/staff/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";
import type { Assignment } from "@/lib/shifts/queries";
import { ShiftChip } from "@/components/shift/ShiftChip";
import { AssignShiftSheet } from "@/components/shift/AssignShiftSheet";

interface DayListProps {
  date: string;
  staff: StaffRecord[];
  shiftTypes: ShiftTypeRecord[];
  assignments: Assignment[];
}

/** Primary mobile screen: one date, staff as a vertical list, tap-to-assign (docs/plan.md, "今日ビュー"). */
export function DayList({ date, staff, shiftTypes, assignments }: DayListProps) {
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);

  if (staff.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-500">
        スタッフが登録されていません。まず「スタッフ」タブから登録してください。
      </p>
    );
  }

  const assignmentByStaffId = new Map(assignments.map((a) => [a.staffId, a]));
  const shiftTypeById = new Map(shiftTypes.map((s) => [s.id, s]));

  const openStaff = staff.find((s) => s.id === openStaffId) ?? null;
  const openAssignment = openStaffId ? assignmentByStaffId.get(openStaffId) : undefined;

  return (
    <>
      <ul className="flex flex-col divide-y divide-gray-100">
        {staff.map((member) => {
          const assignment = assignmentByStaffId.get(member.id);
          const shiftType = assignment ? shiftTypeById.get(assignment.shiftTypeId) : undefined;
          return (
            <li key={member.id} className="flex items-center justify-between px-4 py-4">
              <span className="text-base font-medium">{member.name}</span>
              <ShiftChip
                label={shiftType ? shiftType.code : "休み"}
                isAssigned={Boolean(shiftType)}
                onClick={() => setOpenStaffId(member.id)}
              />
            </li>
          );
        })}
      </ul>
      {openStaff && (
        <AssignShiftSheet
          staffId={openStaff.id}
          staffName={openStaff.name}
          date={date}
          currentShiftTypeId={openAssignment?.shiftTypeId ?? null}
          shiftTypes={shiftTypes}
          onClose={() => setOpenStaffId(null)}
        />
      )}
    </>
  );
}
