"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmDraftShifts,
  discardDraftShifts,
  generateDraftShifts,
} from "@/lib/shifts/generate-actions";

interface MonthActionsProps {
  /** The calendar month containing the week currently being viewed — YYYY-MM. */
  month: string;
  monthStart: string;
  monthEndExclusive: string;
}

/**
 * Month-scoped generate/confirm/discard — the week view (WeekActions) only
 * ever acts on the 7 days on screen, but a manager who wants to set up a
 * whole month at once shouldn't have to tap "この週を自動生成" and
 * "下書きを確定する" separately for every week in it (docs/plan.md gap:
 * 月ごとに作成したい). Reuses the exact same core actions as WeekActions,
 * just called with a month-sized range instead of a week-sized one — the
 * underlying generate/confirm/discard logic doesn't care which.
 *
 * Confirm/discard are always shown (not just when the month already has
 * drafts) rather than fetching the whole month's assignments just to
 * decide — they're harmless no-ops with nothing to confirm/discard.
 */
export function MonthActions({ month, monthStart, monthEndExclusive }: MonthActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const monthLabel = month.replace("-", "年") + "月";

  function handleGenerate() {
    if (
      !window.confirm(
        `${monthLabel}全体の下書きをまとめて作成します(既存の下書きは作り直されます)。よろしいですか？`,
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await generateDraftShifts(monthStart, monthEndExclusive);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const unfilled = result.unfilledShifts ?? [];
      setMessage(
        unfilled.length === 0
          ? `${monthLabel}分の下書きを${result.draftCount}件作成しました。週表示で確認して確定してください。`
          : `${monthLabel}分の下書きを${result.draftCount}件作成しましたが、${unfilled.length}件が人員不足で埋まりませんでした。`,
      );
      router.refresh();
    });
  }

  function handleConfirm() {
    if (!window.confirm(`${monthLabel}全体の下書きをまとめて確定します。よろしいですか？`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await confirmDraftShifts(monthStart, monthEndExclusive);
      if (result.error) setMessage(result.error);
      else {
        setMessage(`${monthLabel}分の下書きを確定しました。`);
        router.refresh();
      }
    });
  }

  function handleDiscard() {
    if (!window.confirm(`${monthLabel}全体の下書きをまとめて破棄します。よろしいですか？`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await discardDraftShifts(monthStart, monthEndExclusive);
      if (result.error) setMessage(result.error);
      else {
        setMessage(`${monthLabel}分の下書きを破棄しました。`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="text-sm font-medium text-gray-600">{monthLabel}をまとめて操作</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          className="rounded-full border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 disabled:opacity-50"
        >
          この月を自動生成
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleConfirm}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
        >
          この月の下書きを確定
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleDiscard}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
        >
          この月の下書きを破棄
        </button>
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}
