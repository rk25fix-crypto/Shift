"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { assignShift } from "@/lib/shifts/actions";
import { requestTimeOff } from "@/lib/time-off/actions";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

interface AssignShiftSheetProps {
  staffId: string;
  staffName: string;
  date: string;
  currentShiftTypeId: string | null;
  isTimeOffRequested: boolean;
  shiftTypes: ShiftTypeRecord[];
  onClose: () => void;
}

/**
 * Bottom sheet for picking one staff member's shift on one date — the
 * primary mobile input pattern for Phase 1a (docs/plan.md, "タップでチップ
 * 選択"), replacing the `<select>`/inline-table editing both legacy
 * prototypes used.
 *
 * A cell is exactly one of: unassigned, a requested day off, or a shift —
 * assignShift/requestTimeOff each clear the other two states server-side
 * (see lib/shifts/assign.ts, lib/time-off/set.ts), so this sheet just needs
 * to show which one is currently selected.
 */
export function AssignShiftSheet({
  staffId,
  staffName,
  date,
  currentShiftTypeId,
  isTimeOffRequested,
  shiftTypes,
  onClose,
}: AssignShiftSheetProps) {
  const [isPending, startTransition] = useTransition();

  const isUnassigned = currentShiftTypeId === null && !isTimeOffRequested;

  function handleSelectShift(shiftTypeId: string | null) {
    startTransition(async () => {
      await assignShift(staffId, date, shiftTypeId);
      onClose();
    });
  }

  function handleSelectTimeOff() {
    startTransition(async () => {
      await requestTimeOff(staffId, date);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-sm font-medium text-gray-600">{staffName}さんのシフト</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSelectShift(null)}
            className={clsx(
              "rounded-lg border px-4 py-3 text-left text-base disabled:opacity-50",
              isUnassigned ? "border-indigo-600 bg-indigo-50" : "border-gray-200",
            )}
          >
            休み(未割当)
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSelectTimeOff}
            className={clsx(
              "rounded-lg border px-4 py-3 text-left text-base disabled:opacity-50",
              isTimeOffRequested ? "border-indigo-600 bg-indigo-50" : "border-gray-200",
            )}
          >
            休み希望
          </button>
          {shiftTypes.map((shiftType) => (
            <button
              key={shiftType.id}
              type="button"
              disabled={isPending}
              onClick={() => handleSelectShift(shiftType.id)}
              className={clsx(
                "rounded-lg border px-4 py-3 text-left text-base disabled:opacity-50",
                currentShiftTypeId === shiftType.id
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200",
              )}
            >
              {shiftType.code} {shiftType.name}({shiftType.startTime}〜{shiftType.endTime})
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 text-center text-sm text-gray-500"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
