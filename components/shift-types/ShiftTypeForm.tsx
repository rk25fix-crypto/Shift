"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createShiftType, updateShiftType, type ShiftTypeInput } from "@/lib/shift-types/actions";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

interface ShiftTypeFormProps {
  /** Present when editing an existing shift type; absent when creating one. */
  existing?: ShiftTypeRecord;
}

const DEFAULT_INPUT: ShiftTypeInput = {
  code: "",
  name: "",
  startTime: "09:00",
  endTime: "18:00",
  crossesMidnight: false,
  breakMinutes: 60,
  isRequired: true,
  isBalanced: true,
  colorKey: null,
  sortOrder: 0,
};

export function ShiftTypeForm({ existing }: ShiftTypeFormProps) {
  const [input, setInput] = useState<ShiftTypeInput>(
    existing
      ? {
          code: existing.code,
          name: existing.name,
          startTime: existing.startTime,
          endTime: existing.endTime,
          crossesMidnight: existing.crossesMidnight,
          breakMinutes: existing.breakMinutes,
          isRequired: existing.isRequired,
          isBalanced: existing.isBalanced,
          colorKey: existing.colorKey,
          sortOrder: existing.sortOrder,
        }
      : DEFAULT_INPUT,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = existing
        ? await updateShiftType(existing.id, input)
        : await createShiftType(input);

      if (result.error) setError(result.error);
      else router.push("/settings/shift-types");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 py-6">
      <label className="flex flex-col gap-1 text-sm">
        コード(例: 早1)
        <input
          type="text"
          required
          value={input.code}
          onChange={(e) => setInput({ ...input, code: e.target.value })}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        名称(例: 早番1)
        <input
          type="text"
          required
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          開始時刻
          <input
            type="time"
            required
            value={input.startTime}
            onChange={(e) => setInput({ ...input, startTime: e.target.value })}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          終了時刻
          <input
            type="time"
            required
            value={input.endTime}
            onChange={(e) => setInput({ ...input, endTime: e.target.value })}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={input.crossesMidnight}
          onChange={(e) => setInput({ ...input, crossesMidnight: e.target.checked })}
          className="h-5 w-5"
        />
        翌日にまたぐシフト(夜勤など)
      </label>

      <label className="flex flex-col gap-1 text-sm">
        休憩時間(分)
        <input
          type="number"
          min={0}
          required
          value={input.breakMinutes}
          onChange={(e) => setInput({ ...input, breakMinutes: Number(e.target.value) })}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={input.isRequired}
          onChange={(e) => setInput({ ...input, isRequired: e.target.checked })}
          className="h-5 w-5"
        />
        毎日必須のシフト(未充足なら警告する)
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={input.isBalanced}
          onChange={(e) => setInput({ ...input, isBalanced: e.target.checked })}
          className="h-5 w-5"
        />
        自動生成で均等に割り振る対象にする
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : existing ? "更新する" : "追加する"}
      </button>
    </form>
  );
}
