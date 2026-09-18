"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmDraftShifts,
  discardDraftShifts,
  generateDraftShifts,
} from "@/lib/shifts/generate-actions";

interface WeekActionsProps {
  startDate: string;
  endDateExclusive: string;
  hasRequiredShiftTypes: boolean;
  hasDrafts: boolean;
}

/** Generate/confirm/discard controls for one week — sits above WeekGrid on the week view. */
export function WeekActions({
  startDate,
  endDateExclusive,
  hasRequiredShiftTypes,
  hasDrafts,
}: WeekActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleGenerate() {
    if (hasDrafts && !window.confirm("この週の下書きをすべて作り直します。よろしいですか？")) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await generateDraftShifts(startDate, endDateExclusive);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const unfilled = result.unfilledShifts ?? [];
      setMessage(
        unfilled.length === 0
          ? `${result.draftCount}件の下書きを作成しました。内容を確認して確定してください。`
          : `${result.draftCount}件の下書きを作成しましたが、${unfilled.length}件が人員不足で埋まりませんでした。`,
      );
      router.refresh();
    });
  }

  function handleConfirm() {
    setMessage(null);
    startTransition(async () => {
      const result = await confirmDraftShifts(startDate, endDateExclusive);
      if (result.error) setMessage(result.error);
      else {
        setMessage("この週の下書きを確定しました。");
        router.refresh();
      }
    });
  }

  function handleDiscard() {
    if (!window.confirm("この週の下書きをすべて破棄します。よろしいですか？")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await discardDraftShifts(startDate, endDateExclusive);
      if (result.error) setMessage(result.error);
      else {
        setMessage("この週の下書きを破棄しました。");
        router.refresh();
      }
    });
  }

  if (!hasRequiredShiftTypes) {
    return (
      <p className="px-4 text-sm text-gray-500">
        自動生成を使うには、設定 &gt; シフト種別で「毎日必須のシフト」を1つ以上有効にしてください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          className="rounded-full border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 disabled:opacity-50"
        >
          この週を自動生成
        </button>
        {hasDrafts && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirm}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              下書きを確定する
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDiscard}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
            >
              下書きを破棄する
            </button>
          </>
        )}
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
