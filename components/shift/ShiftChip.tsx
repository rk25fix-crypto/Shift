"use client";

import clsx from "clsx";

interface ShiftChipProps {
  label: string;
  isAssigned: boolean;
  onClick: () => void;
}

/** Tappable chip showing a staff member's shift for one date — opens AssignShiftSheet. */
export function ShiftChip({ label, isAssigned, onClick }: ShiftChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "min-w-16 rounded-full border px-4 py-2 text-sm font-medium",
        isAssigned
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-gray-300 text-gray-500",
      )}
    >
      {label}
    </button>
  );
}
