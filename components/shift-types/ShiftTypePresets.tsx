"use client";

import { useState, useTransition } from "react";
import { createShiftType } from "@/lib/shift-types/actions";
import { SHIFT_TYPE_PRESETS } from "@/lib/shift-types/presets";

/**
 * よく使うシフトパターンをタップひとつで追加できるショートカット。
 * 「+ 追加」からの毎回フル入力(コード・名称・時刻・休憩時間…)が
 * 初期設定で面倒という声を受けて追加 — 妥当な既定値でまず作成し、
 * 必要なら一覧から編集画面で調整すればよいようにする。
 */
export function ShiftTypePresets() {
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(preset: (typeof SHIFT_TYPE_PRESETS)[number]) {
    setError(null);
    setPendingLabel(preset.label);
    startTransition(async () => {
      const result = await createShiftType(preset.input);
      if (result.error) setError(`${preset.label}: ${result.error}`);
      setPendingLabel(null);
    });
  }

  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="text-sm font-medium text-gray-600">よく使うパターンから追加</p>
      <div className="flex flex-wrap gap-2">
        {SHIFT_TYPE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={isPending}
            onClick={() => handleAdd(preset)}
            className="rounded-full border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-50"
          >
            {isPending && pendingLabel === preset.label ? "追加中..." : `+ ${preset.label}`}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
