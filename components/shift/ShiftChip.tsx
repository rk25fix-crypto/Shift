"use client";

import type { ShiftTypeColor } from "@/lib/shift-types/colors";

interface ShiftChipProps {
  label: string;
  isAssigned: boolean;
  /** A generated-but-unconfirmed shift (docs/plan.md's draft workflow) — shown distinctly so it's never mistaken for a real, published assignment. */
  isDraft?: boolean;
  /** Shift-type color from lib/shift-types/colors.ts — omitted for the unassigned/休み state. */
  color?: ShiftTypeColor;
  onClick: () => void;
}

/** Tappable chip showing a staff member's shift for one date — opens AssignShiftSheet. */
export function ShiftChip({ label, isAssigned, isDraft, color, onClick }: ShiftChipProps) {
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
          : isDraft
            ? "min-w-16 rounded-full border border-dashed px-4 py-2 text-sm font-bold font-heading border-primary-hover-border bg-surface text-primary-ink"
            : "min-w-16 rounded-full border px-4 py-2 text-sm font-medium border-border text-ink-weakest"
      }
    >
      {label}
    </button>
  );
}
