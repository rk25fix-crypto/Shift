"use client";

import { useState } from "react";
import type { StaffRecord } from "@/lib/staff/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";
import type { Assignment } from "@/lib/shifts/queries";
import type { TimeOff } from "@/lib/time-off/queries";
import { formatDateJapanese } from "@/lib/date";
import { AssignShiftSheet } from "@/components/shift/AssignShiftSheet";
import { OFF_COLOR, shiftTypeColor } from "@/lib/shift-types/colors";

interface WeekGridProps {
  dates: string[];
  staff: StaffRecord[];
  shiftTypes: ShiftTypeRecord[];
  assignments: Assignment[];
  timeOff: TimeOff[];
  /** Staff with a 勤務ルール警告 overlapping this week (lib/shifts/labor-warnings.ts) — shown as a badge next to their name. */
  staffIdsWithWarnings?: Set<string>;
  /** Dates where a required shift type doesn't yet have enough staff assigned (lib/shifts/unfilled-dates.ts) — shown as a badge on the date header. */
  unfilledDates?: Set<string>;
}

const GRID_COLUMNS = "88px repeat(7, 1fr)";

/** 7-day × staff grid that fits a 390px viewport without horizontal scroll (design handoff 2b). */
export function WeekGrid({
  dates,
  staff,
  shiftTypes,
  assignments,
  timeOff,
  staffIdsWithWarnings,
  unfilledDates,
}: WeekGridProps) {
  const [openCell, setOpenCell] = useState<{ staffId: string; date: string } | null>(null);

  if (staff.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-ink-weak">
        スタッフが登録されていません。まず「スタッフ」タブから登録してください。
      </p>
    );
  }

  const shiftTypeById = new Map(shiftTypes.map((s) => [s.id, s]));
  const shiftTypeIndexById = new Map(shiftTypes.map((s, i) => [s.id, i]));
  const assignmentByStaffDate = new Map(
    assignments.map((a) => [`${a.staffId}|${a.date}`, a]),
  );
  const timeOffByStaffDate = new Set(timeOff.map((t) => `${t.staffId}|${t.date}`));

  const openStaff = openCell ? staff.find((s) => s.id === openCell.staffId) : undefined;
  const openAssignment = openCell
    ? assignmentByStaffDate.get(`${openCell.staffId}|${openCell.date}`)
    : undefined;
  const openIsTimeOff = openCell ? timeOffByStaffDate.has(`${openCell.staffId}|${openCell.date}`) : false;

  return (
    <>
      <div className="px-4">
        <div
          className="grid items-center gap-y-1 border-b border-border-subtle pb-2 text-center text-[11px] font-bold text-ink-weakest"
          style={{ gridTemplateColumns: GRID_COLUMNS }}
        >
          <span className="text-left">スタッフ</span>
          {dates.map((date) => (
            <div key={date} className="flex flex-col items-center gap-0.5">
              <span>{formatDateJapanese(date).replace(/^\d+月/, "")}</span>
              {unfilledDates?.has(date) && (
                <span
                  aria-label="人数不足の日"
                  className="rounded-full px-1.5 text-[10px] font-bold"
                  style={{ background: "var(--color-danger-soft)", color: "var(--color-danger-ink)" }}
                >
                  不足
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {staff.map((member) => (
            <div
              key={member.id}
              className="grid items-center gap-y-1 py-2"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              <span className="truncate pr-1 text-left text-[13px] font-bold text-ink">
                {member.name}
                {staffIdsWithWarnings?.has(member.id) && (
                  <span aria-label="勤務ルール警告あり" className="ml-0.5">
                    ⚠
                  </span>
                )}
              </span>
              {dates.map((date) => {
                const key = `${member.id}|${date}`;
                const assignment = assignmentByStaffDate.get(key);
                const shiftType = assignment ? shiftTypeById.get(assignment.shiftTypeId) : undefined;
                const isTimeOff = !shiftType && timeOffByStaffDate.has(key);
                const color = shiftType ? shiftTypeColor(shiftTypeIndexById.get(shiftType.id) ?? 0) : undefined;
                return (
                  <div key={date} className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setOpenCell({ staffId: member.id, date })}
                      style={
                        color
                          ? {
                              background: color.bg,
                              color: color.text,
                              borderColor:
                                assignment?.status === "draft"
                                  ? "var(--color-primary-hover-border)"
                                  : "transparent",
                              borderStyle: assignment?.status === "draft" ? "dashed" : "solid",
                            }
                          : isTimeOff
                            ? { background: OFF_COLOR.bg, color: OFF_COLOR.text }
                            : undefined
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] border text-xs font-bold"
                    >
                      {shiftType ? shiftType.code : isTimeOff ? "休" : "―"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {shiftTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 text-[11px] text-ink-weakest">
          {shiftTypes.map((shiftType, i) => {
            const color = shiftTypeColor(i);
            return (
              <span
                key={shiftType.id}
                className="flex items-center gap-1 rounded-full px-2 py-1"
                style={{ background: color.bg, color: color.text }}
              >
                {shiftType.code} {shiftType.name}
              </span>
            );
          })}
        </div>
      )}
      {openStaff && openCell && (
        <AssignShiftSheet
          staffId={openStaff.id}
          staffName={openStaff.name}
          date={openCell.date}
          currentShiftTypeId={openAssignment?.shiftTypeId ?? null}
          isTimeOffRequested={openIsTimeOff}
          shiftTypes={shiftTypes}
          onClose={() => setOpenCell(null)}
        />
      )}
    </>
  );
}
