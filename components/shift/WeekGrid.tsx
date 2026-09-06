"use client";

import { useState } from "react";
import type { StaffRecord } from "@/lib/staff/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";
import type { Assignment } from "@/lib/shifts/queries";
import { formatDateJapanese } from "@/lib/date";
import { ShiftChip } from "@/components/shift/ShiftChip";
import { AssignShiftSheet } from "@/components/shift/AssignShiftSheet";

interface WeekGridProps {
  dates: string[];
  staff: StaffRecord[];
  shiftTypes: ShiftTypeRecord[];
  assignments: Assignment[];
}

/** 7-day × staff grid — a horizontally-scrollable week overview, unlike the Today view's single-date focus (docs/plan.md, "週グリッド"). */
export function WeekGrid({ dates, staff, shiftTypes, assignments }: WeekGridProps) {
  const [openCell, setOpenCell] = useState<{ staffId: string; date: string } | null>(null);

  if (staff.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-500">
        スタッフが登録されていません。まず「スタッフ」タブから登録してください。
      </p>
    );
  }

  const shiftTypeById = new Map(shiftTypes.map((s) => [s.id, s]));
  const assignmentByStaffDate = new Map(
    assignments.map((a) => [`${a.staffId}|${a.date}`, a]),
  );

  const openStaff = openCell ? staff.find((s) => s.id === openCell.staffId) : undefined;
  const openAssignment = openCell
    ? assignmentByStaffDate.get(`${openCell.staffId}|${openCell.date}`)
    : undefined;

  return (
    <>
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white px-2 py-2 text-left font-medium text-gray-500">
                スタッフ
              </th>
              {dates.map((date) => (
                <th key={date} className="px-2 py-2 text-center font-medium text-gray-500">
                  {formatDateJapanese(date).replace(/^\d+月/, "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-t border-gray-100">
                <th className="sticky left-0 bg-white px-2 py-3 text-left font-medium">
                  {member.name}
                </th>
                {dates.map((date) => {
                  const assignment = assignmentByStaffDate.get(`${member.id}|${date}`);
                  const shiftType = assignment ? shiftTypeById.get(assignment.shiftTypeId) : undefined;
                  return (
                    <td key={date} className="px-2 py-2 text-center">
                      <ShiftChip
                        label={shiftType ? shiftType.code : "―"}
                        isAssigned={Boolean(shiftType)}
                        onClick={() => setOpenCell({ staffId: member.id, date })}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openStaff && openCell && (
        <AssignShiftSheet
          staffId={openStaff.id}
          staffName={openStaff.name}
          date={openCell.date}
          currentShiftTypeId={openAssignment?.shiftTypeId ?? null}
          shiftTypes={shiftTypes}
          onClose={() => setOpenCell(null)}
        />
      )}
    </>
  );
}
