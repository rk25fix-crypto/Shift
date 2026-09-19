"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSwap } from "@/lib/swaps/actions";
import type { StaffRecord } from "@/lib/staff/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";
import { todayInTimezone } from "@/lib/date";

interface SwapRequestFormProps {
  staff: StaffRecord[];
  shiftTypes: ShiftTypeRecord[];
}

const NONE = "";

/**
 * Manager-entered swap request (docs/plan.md — staff self-service submission
 * waits for Phase 3's staff login, same as lib/time-off/set.ts's proxy
 * entry). A manager records what each side currently works and wants to
 * give up; the actual schedule isn't touched until an owner/admin approves
 * it from SwapRequestList — see lib/swaps/write.ts's decideSwapRequestCore.
 */
export function SwapRequestForm({ staff, shiftTypes }: SwapRequestFormProps) {
  const [date, setDate] = useState(todayInTimezone());
  const [fromStaffId, setFromStaffId] = useState(staff[0]?.id ?? NONE);
  const [toStaffId, setToStaffId] = useState(staff[1]?.id ?? staff[0]?.id ?? NONE);
  const [fromShiftTypeId, setFromShiftTypeId] = useState(NONE);
  const [toShiftTypeId, setToShiftTypeId] = useState(NONE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await requestSwap({
        date,
        fromStaffId,
        toStaffId,
        fromShiftTypeId: fromShiftTypeId || null,
        toShiftTypeId: toShiftTypeId || null,
      });
      if (result.error) setError(result.error);
      else {
        setFromShiftTypeId(NONE);
        setToShiftTypeId(NONE);
        router.refresh();
      }
    });
  }

  if (staff.length < 2) {
    return (
      <p className="px-4 text-sm text-gray-500">交代申請にはスタッフが2人以上必要です。</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4">
      <label className="flex flex-col gap-1 text-sm">
        日付
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-600">交代したいスタッフ</p>
        <label className="flex flex-col gap-1 text-sm">
          スタッフ
          <select
            value={fromStaffId}
            onChange={(e) => setFromStaffId(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          現在のシフト(手放す側、無ければ「なし」)
          <select
            value={fromShiftTypeId}
            onChange={(e) => setFromShiftTypeId(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
          >
            <option value={NONE}>なし(休みだった)</option>
            {shiftTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
        <p className="text-sm font-medium text-gray-600">交代相手</p>
        <label className="flex flex-col gap-1 text-sm">
          スタッフ
          <select
            value={toStaffId}
            onChange={(e) => setToStaffId(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          現在のシフト(手放す側、無ければ「なし」)
          <select
            value={toShiftTypeId}
            onChange={(e) => setToShiftTypeId(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
          >
            <option value={NONE}>なし(休みだった)</option>
            {shiftTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white disabled:opacity-50"
      >
        {isPending ? "申請中..." : "この内容で交代申請を作る"}
      </button>
    </form>
  );
}
