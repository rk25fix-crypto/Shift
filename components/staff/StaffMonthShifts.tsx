"use client";

import { useState, useTransition } from "react";
import { formatDateJapanese } from "@/lib/date";
import { recordActualShiftTimeAsManager } from "@/lib/shifts/actions";
import type { Assignment } from "@/lib/shifts/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

export function StaffMonthShifts({
  staffId,
  assignments,
  shiftTypes,
  canManage,
}: {
  staffId: string;
  assignments: Assignment[];
  shiftTypes: ShiftTypeRecord[];
  canManage: boolean;
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
          <MonthShiftRow
            key={assignment.id}
            staffId={staffId}
            assignment={assignment}
            shiftType={shiftType}
            canManage={canManage}
          />
        );
      })}
    </ul>
  );
}

function MonthShiftRow({
  staffId,
  assignment,
  shiftType,
  canManage,
}: {
  staffId: string;
  assignment: Assignment;
  shiftType: ShiftTypeRecord | undefined;
  canManage: boolean;
}) {
  const scheduledStart = shiftType?.startTime ?? "";
  const scheduledEnd = shiftType?.endTime ?? "";
  const [actualStart, setActualStart] = useState(assignment.actualStartTime ?? scheduledStart);
  const [actualEnd, setActualEnd] = useState(assignment.actualEndTime ?? scheduledEnd);
  const [recorded, setRecorded] = useState({
    start: assignment.actualStartTime,
    end: assignment.actualEndTime,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const { error } = await recordActualShiftTimeAsManager(
        staffId,
        assignment.date,
        actualStart,
        actualEnd,
      );
      if (error) {
        setError(error);
        return;
      }
      setRecorded({ start: actualStart, end: actualEnd });
      setIsEditing(false);
    });
  }

  return (
    <li className="flex flex-col gap-1 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span>{formatDateJapanese(assignment.date)}</span>
        <span className="font-medium">{shiftType ? `${shiftType.code} ${shiftType.name}` : "—"}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-ink-weak">
        <span>
          予定 {scheduledStart}〜{scheduledEnd} / 実績{" "}
          {recorded.start && recorded.end ? `${recorded.start}〜${recorded.end}` : "未記録"}
        </span>
        {canManage && !isEditing && (
          <button type="button" onClick={() => setIsEditing(true)} className="font-bold text-primary-ink">
            修正する
          </button>
        )}
      </div>

      {canManage && isEditing && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={actualStart}
              onChange={(e) => setActualStart(e.target.value)}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-base"
            />
            <span className="text-ink-weak">〜</span>
            <input
              type="time"
              value={actualEnd}
              onChange={(e) => setActualEnd(e.target.value)}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-base"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={save}
              className="flex-1 rounded-full px-4 py-2 text-sm font-bold font-heading text-white disabled:opacity-50"
              style={{ background: "var(--color-primary)" }}
            >
              {isPending ? "保存中..." : "この内容で保存する"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-border px-4 py-2 text-sm text-ink-weak"
            >
              やめる
            </button>
          </div>
          {error && (
            <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
