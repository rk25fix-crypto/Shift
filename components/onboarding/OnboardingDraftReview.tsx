"use client";

import { useState, useTransition } from "react";
import { confirmDraftShifts } from "@/lib/shifts/generate-actions";
import { shiftTypeColor } from "@/lib/shift-types/colors";
import { addDays, formatDateJapanese } from "@/lib/date";
import { ONBOARDING_DRAFT_STORAGE_KEY, type OnboardingDraft } from "@/components/onboarding/draftReviewStorage";

/**
 * ステップ3「できあがり」の下書きグリッド確認(design_handoff … README「1a」)
 * — サインアップ完了直後、/todayの初回表示に一度だけ出す。OnboardingWizard
 * がsessionStorageに置いた下書きを読み、確定 or 後回しを選ばせる。/signup
 * 自体に留めて表示できない理由はOnboardingWizard.tsx's handleFinishのコメント
 * を参照。
 */
/**
 * Reads (and clears) the handed-off draft once, during the component's
 * first render — not a useEffect, since this is a one-shot read of state
 * that lives outside React, not a subscription to something that changes
 * over time. Guarded for SSR: this component's own render still executes
 * server-side for the initial HTML, where sessionStorage doesn't exist.
 */
function readAndClearHandoff(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    // sessionStorage unavailable, or the stored value wasn't valid JSON —
    // either way there's nothing to show; the drafts themselves are
    // already saved and confirmable from the home FAB regardless.
    return null;
  }
}

export function OnboardingDraftReview() {
  const [draft, setDraft] = useState<OnboardingDraft | null>(readAndClearHandoff);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!draft) return null;

  function handleConfirm() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const monday = draft.dates[0];
      const weekEndExclusive = addDays(draft.dates[draft.dates.length - 1], 1);
      const result = await confirmDraftShifts(monday, weekEndExclusive);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(null);
    });
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center"
      style={{ background: "rgba(43,39,34,.32)" }}
    >
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-t-[26px] bg-surface p-5">
        <h2 className="text-center text-xl font-bold font-heading text-ink">できあがり</h2>
        <div className="overflow-hidden rounded-[18px] border border-border">
          <div
            className="grid items-center gap-y-1 border-b border-border-subtle bg-surface-canvas px-2 py-2 text-center text-[10px] font-bold text-ink-weakest"
            style={{ gridTemplateColumns: "76px repeat(7, 1fr)" }}
          >
            <span className="text-left">スタッフ</span>
            {draft.dates.map((date) => (
              <span key={date}>{formatDateJapanese(date).replace(/^\d+月/, "")}</span>
            ))}
          </div>
          <div className="flex flex-col divide-y divide-border-subtle">
            {draft.staff.map((member) => (
              <div
                key={member.id}
                className="grid items-center gap-y-1 px-2 py-2"
                style={{ gridTemplateColumns: "76px repeat(7, 1fr)" }}
              >
                <span className="truncate pr-1 text-left text-[12px] font-bold text-ink">
                  {member.name}
                </span>
                {draft.dates.map((date) => {
                  const assignment = draft.assignments.find(
                    (a) => a.staffId === member.id && a.date === date,
                  );
                  const shiftTypeIndex = assignment
                    ? draft.shiftTypes.findIndex((t) => t.id === assignment.shiftTypeId)
                    : -1;
                  const shiftType = shiftTypeIndex >= 0 ? draft.shiftTypes[shiftTypeIndex] : undefined;
                  const color = shiftType ? shiftTypeColor(shiftTypeIndex) : undefined;
                  return (
                    <div key={date} className="flex justify-center">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[11px] font-bold"
                        style={
                          color
                            ? { background: color.bg, color: color.text }
                            : { color: "var(--color-ink-weakest)" }
                        }
                      >
                        {shiftType ? shiftType.code : "―"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <p
          className="rounded-[16px] border px-4 py-3 text-sm font-bold"
          style={{
            borderColor: "var(--color-success-border)",
            background: "var(--color-success-soft)",
            color: "var(--color-success-ink)",
          }}
        >
          連勤・休憩のきまりも自動で確認しました
        </p>
        {error && (
          <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={handleConfirm}
          className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {isPending ? "確定しています…" : "これで確定してはじめる"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setDraft(null)}
          className="text-xs text-ink-weakest underline"
        >
          あとで確認する
        </button>
      </div>
    </div>
  );
}
