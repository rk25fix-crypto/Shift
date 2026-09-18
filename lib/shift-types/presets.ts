import type { ShiftTypeInput } from "@/lib/shift-types/actions";

export interface ShiftTypePreset {
  /** Shown on the one-tap button. */
  label: string;
  input: ShiftTypeInput;
}

/**
 * よくあるシフトパターンをワンタップで登録できるようにする既定値集
 * (初期設定の手間を減らすため — 毎回コード・時刻・休憩時間などをすべて
 * 手入力しなくても、まず妥当な値で作成し、必要なら編集画面で調整すれば
 * よいようにする)。すべて「毎日必須のシフト」として作成するので、
 * 自動生成でそのまま使える状態になる。
 */
export const SHIFT_TYPE_PRESETS: ShiftTypePreset[] = [
  {
    label: "早番",
    input: {
      code: "早",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      crossesMidnight: false,
      breakMinutes: 60,
      isRequired: true,
      isBalanced: true,
      requiredCount: 1,
      colorKey: null,
      sortOrder: 0,
    },
  },
  {
    label: "日勤",
    input: {
      code: "日",
      name: "日勤",
      startTime: "09:00",
      endTime: "18:00",
      crossesMidnight: false,
      breakMinutes: 60,
      isRequired: true,
      isBalanced: true,
      requiredCount: 1,
      colorKey: null,
      sortOrder: 0,
    },
  },
  {
    label: "遅番",
    input: {
      code: "遅",
      name: "遅番",
      startTime: "13:00",
      endTime: "22:00",
      crossesMidnight: false,
      breakMinutes: 60,
      isRequired: true,
      isBalanced: true,
      requiredCount: 1,
      colorKey: null,
      sortOrder: 0,
    },
  },
  {
    label: "夜勤",
    input: {
      code: "夜",
      name: "夜勤",
      startTime: "22:00",
      endTime: "07:00",
      crossesMidnight: true,
      breakMinutes: 60,
      isRequired: true,
      isBalanced: true,
      requiredCount: 1,
      colorKey: null,
      sortOrder: 0,
    },
  },
];
