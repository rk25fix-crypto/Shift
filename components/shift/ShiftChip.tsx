"use client";

import type { ShiftTypeColor } from "@/lib/shift-types/colors";

interface ShiftChipProps {
  label: string;
  isAssigned: boolean;
  /** Shift-type color from lib/shift-types/colors.ts — omitted for the unassigned/休み state. */
  color?: ShiftTypeColor;
  onClick: () => void;
}

/** Tappable chip showing a staff member's shift for one date (DayList) — opens AssignShiftSheet. */
export function ShiftChip({ label, isAssigned, color, onClick }: ShiftChipProps) {
  const style =
    isAssigned && color
      ? { background: color.bg, color: color.text, borderColor: color.border }
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={
        isAssigned && color
          ? "min-w-16 rounded-full border px-4 py-2 text-sm font-bold font-heading"
          : "min-w-16 rounded-full border px-4 py-2 text-sm font-medium border-border text-ink-weakest"
      }
    >
      {label}
    </button>
  );
}
