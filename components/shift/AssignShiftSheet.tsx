"use client";

import { useEffect, useState, useTransition } from "react";
import { assignShift } from "@/lib/shifts/actions";
import { requestTimeOff } from "@/lib/time-off/actions";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";
import { OFF_COLOR, shiftTypeColor } from "@/lib/shift-types/colors";

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
 * to show which one is currently selected. Selecting an option saves and
 * closes immediately — no separate confirm step (design handoff 1b).
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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

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
      className="fixed inset-0 z-30 flex flex-col justify-end bg-lock-bg/32"
      onClick={onClose}
    >
      <div
        className="rounded-t-[26px] bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-transform duration-300 ease-out"
        style={{ transform: isVisible ? "translateY(0)" : "translateY(100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-[42px] rounded-full bg-border" />
        <p className="mb-3 text-sm font-medium text-ink-weak">{staffName}さんのシフト</p>
        <div className="grid grid-cols-2 gap-2">
          <SheetOption
            label="休み(未割当)"
            color={OFF_COLOR}
            isSelected={isUnassigned}
            disabled={isPending}
            onClick={() => handleSelectShift(null)}
          />
          <SheetOption
            label="休み希望"
            color={OFF_COLOR}
            isSelected={isTimeOffRequested}
            disabled={isPending}
            onClick={handleSelectTimeOff}
          />
          {shiftTypes.map((shiftType, index) => (
            <SheetOption
              key={shiftType.id}
              label={`${shiftType.code} ${shiftType.name}(${shiftType.startTime}〜${shiftType.endTime})`}
              color={shiftTypeColor(index)}
              isSelected={currentShiftTypeId === shiftType.id}
              disabled={isPending}
              onClick={() => handleSelectShift(shiftType.id)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 text-center text-sm text-ink-weak"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

function SheetOption({
  label,
  color,
  isSelected,
  disabled,
  onClick,
}: {
  label: string;
  color: { bg: string; text: string; border: string };
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={
        isSelected
          ? { background: color.bg, color: color.text, borderColor: "var(--color-primary)" }
          : undefined
      }
      className={
        isSelected
          ? "min-h-11 rounded-[14px] border-2 px-3 py-3 text-left text-sm font-medium disabled:opacity-50"
          : "min-h-11 rounded-[14px] border border-border px-3 py-3 text-left text-sm font-medium text-ink disabled:opacity-50"
      }
    >
      {label}
    </button>
  );
}
