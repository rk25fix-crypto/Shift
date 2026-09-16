/**
 * Shift-type chip colors cycle through this 4-color palette in registration
 * order (design_handoff_shift_bright_flow/README.md, "シフト種別の色は登録順
 * に次のパレットを循環させる") — colorKey exists on the record but nothing
 * ever sets it, so index-based cycling is what's actually available today.
 */
const PALETTE = [
  { bg: "var(--color-primary-soft)", text: "var(--color-primary-ink)", border: "var(--color-primary-soft-border)" },
  { bg: "var(--color-info-soft)", text: "var(--color-info-ink)", border: "var(--color-info-border)" },
  { bg: "var(--color-late-soft)", text: "var(--color-late-ink)", border: "var(--color-late-soft)" },
  { bg: "var(--color-success-soft)", text: "var(--color-success-ink)", border: "var(--color-success-border)" },
] as const;

export interface ShiftTypeColor {
  bg: string;
  text: string;
  border: string;
}

export const OFF_COLOR: ShiftTypeColor = {
  bg: "var(--color-off-bg)",
  text: "var(--color-off-ink)",
  border: "var(--color-off-bg)",
};

export function shiftTypeColor(index: number): ShiftTypeColor {
  return PALETTE[index % PALETTE.length];
}
