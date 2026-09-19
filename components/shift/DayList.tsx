"use client";

import { useState } from "react";
import type { StaffRecord } from "@/lib/staff/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";
import type { Assignment } from "@/lib/shifts/queries";
import type { TimeOff } from "@/lib/time-off/queries";
import { ShiftChip } from "@/components/shift/ShiftChip";
import { AssignShiftSheet } from "@/components/shift/AssignShiftSheet";
import { shiftTypeColor } from "@/lib/shift-types/colors";

interface DayListProps {
  date: string;
  staff: StaffRecord[];
  shiftTypes: ShiftTypeRecord[];
  assignments: Assignment[];
  timeOff: TimeOff[];
}

/** Primary mobile screen: one date, staff as a vertical list, tap-to-assign (docs/plan.md, "今日ビュー"). */
export function DayList({ date, staff, shiftTypes, assignments, timeOff }: DayListProps) {
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);

  if (staff.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-ink-weak">
        スタッフが登録されていません。まず「スタッフ」タブから登録してください。
      </p>
    );
  }

  const assignmentByStaffId = new Map(assignments.map((a) => [a.staffId, a]));
  const shiftTypeById = new Map(shiftTypes.map((s) => [s.id, s]));
  const shiftTypeIndexById = new Map(shiftTypes.map((s, i) => [s.id, i]));
  const timeOffByStaffId = new Set(timeOff.map((t) => t.staffId));

  const openStaff = staff.find((s) => s.id === openStaffId) ?? null;
  const openAssignment = openStaffId ? assignmentByStaffId.get(openStaffId) : undefined;
  const openIsTimeOff = openStaffId ? timeOffByStaffId.has(openStaffId) : false;

  return (
    <>
      <ul className="flex flex-col gap-2 px-4">
        {staff.map((member) => {
          const assignment = assignmentByStaffId.get(member.id);
          const shiftType = assignment ? shiftTypeById.get(assignment.shiftTypeId) : undefined;
          const isTimeOff = !shiftType && timeOffByStaffId.has(member.id);
          const label = shiftType ? shiftType.code : isTimeOff ? "休み希望" : "休み";
          return (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold font-heading text-primary-ink">
                  {member.name.slice(0, 1)}
                </span>
                <span className="text-[15px] font-bold font-heading text-ink">{member.name}</span>
              </div>
              <ShiftChip
                label={label}
                isAssigned={Boolean(shiftType)}
                color={shiftType ? shiftTypeColor(shiftTypeIndexById.get(shiftType.id) ?? 0) : undefined}
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
          isTimeOffRequested={openIsTimeOff}
          shiftTypes={shiftTypes}
          onClose={() => setOpenStaffId(null)}
        />
      )}
    </>
  );
}
