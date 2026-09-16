import type { ShiftTypeInput } from "@/lib/shift-types/actions";

export interface ShiftTypePreset {
  /** Shown on the one-tap button. */
  label: string;
  input: ShiftTypeInput;
}

function preset(code: string, name: string, startTime: string, endTime: string, crossesMidnight = false): ShiftTypePreset {
  return {
    label: name,
    input: {
      code,
      name,
      startTime,
      endTime,
      crossesMidnight,
      breakMinutes: 60,
      isRequired: true,
      isBalanced: true,
      requiredCount: 1,
      colorKey: null,
      sortOrder: 0,
    },
  };
}

/**
 * よくあるシフトパターンをワンタップで登録できるようにする既定値集
 * (初期設定の手間を減らすため — 毎回コード・時刻・休憩時間などをすべて
 * 手入力しなくても、まず妥当な値で作成し、必要なら編集画面で調整すれば
 * よいようにする)。すべて「毎日必須のシフト」として作成するので、
 * 自動生成でそのまま使える状態になる。設定 > シフト種別のワンタップ追加
 * ボタン用の汎用セット。
 */
export const SHIFT_TYPE_PRESETS: ShiftTypePreset[] = [
  preset("早", "早番", "07:00", "16:00"),
  preset("日", "日勤", "09:00", "18:00"),
  preset("遅", "遅番", "13:00", "22:00"),
  preset("夜", "夜勤", "22:00", "07:00", true),
];

export type IndustryKey = "nursery" | "care" | "restaurant" | "retail" | "clinic" | "other";

export interface IndustryOption {
  key: IndustryKey;
  label: string;
  description: string;
}

/** ステップ0「業種をえらぶ」の選択肢(design_handoff_shift_bright_flow/README.md)。 */
export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { key: "nursery", label: "保育園・幼稚園", description: "早番・日勤・遅番" },
  { key: "care", label: "介護・福祉施設", description: "早番・日勤・遅番・夜勤" },
  { key: "restaurant", label: "飲食店", description: "開店・中番・閉店" },
  { key: "retail", label: "小売・コンビニ", description: "早番・日中・深夜" },
  { key: "clinic", label: "クリニック・歯科", description: "午前・終日・午後" },
  { key: "other", label: "その他", description: "早番・日勤・遅番" },
];

/** 業種ごとの自動生成シフト種別(design_handoff_shift_bright_flow/README.md「業種プリセット」)。 */
export const INDUSTRY_SHIFT_TYPE_PRESETS: Record<IndustryKey, ShiftTypePreset[]> = {
  nursery: [
    preset("早", "早番", "07:00", "16:00"),
    preset("日", "日勤", "08:30", "17:30"),
    preset("遅", "遅番", "10:00", "19:00"),
  ],
  care: [
    preset("早", "早番", "07:00", "16:00"),
    preset("日", "日勤", "09:00", "18:00"),
    preset("遅", "遅番", "11:00", "20:00"),
    preset("夜", "夜勤", "16:00", "09:00", true),
  ],
  restaurant: [
    preset("開", "開店", "09:00", "17:00"),
    preset("中", "中番", "11:00", "20:00"),
    preset("閉", "閉店", "15:00", "23:00"),
  ],
  retail: [
    preset("早", "早番", "06:00", "14:00"),
    preset("昼", "日中", "14:00", "22:00"),
    preset("深", "深夜", "22:00", "06:00", true),
  ],
  clinic: [
    preset("前", "午前", "08:30", "13:00"),
    preset("終", "終日", "08:30", "18:00"),
    preset("後", "午後", "13:30", "18:00"),
  ],
  other: [
    preset("早", "早番", "07:00", "16:00"),
    preset("日", "日勤", "09:00", "18:00"),
    preset("遅", "遅番", "13:00", "22:00"),
  ],
};
