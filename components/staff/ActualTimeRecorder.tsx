"use client";

import { useState, useTransition } from "react";
import { recordOwnActualShiftTime } from "@/lib/staff-auth/actions";

interface ActualTimeRecorderProps {
  date: string;
  scheduledStart: string;
  scheduledEnd: string;
  initialActualStart: string | null;
  initialActualEnd: string | null;
}

/**
 * 「毎日退勤時に勤務時間を入力する」操作(design intent)。予定通りなら
 * ワンタップ、違えば時刻を選び直すだけ — フォームを開かせない。記録後は
 * 実績として給与・稼働レポートの計算に使われる
 * (lib/shifts/worked-shift.ts's resolveAssignmentTimes)。
 */
export function ActualTimeRecorder({
  date,
  scheduledStart,
  scheduledEnd,
  initialActualStart,
  initialActualEnd,
}: ActualTimeRecorderProps) {
  const [actualStart, setActualStart] = useState(initialActualStart ?? scheduledStart);
  const [actualEnd, setActualEnd] = useState(initialActualEnd ?? scheduledEnd);
  const [recordedStart, setRecordedStart] = useState(initialActualStart);
  const [recordedEnd, setRecordedEnd] = useState(initialActualEnd);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function record(startTime: string, endTime: string) {
    setError(null);
    startTransition(async () => {
      const { error } = await recordOwnActualShiftTime(date, startTime, endTime);
      if (error) {
        setError(error);
        return;
      }
      setRecordedStart(startTime);
      setRecordedEnd(endTime);
      setIsEditing(false);
    });
  }

  const isRecorded = recordedStart != null && recordedEnd != null;
  const matchesSchedule = recordedStart === scheduledStart && recordedEnd === scheduledEnd;

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-border bg-surface p-4">
      <p className="text-sm font-bold text-ink">本日の退勤</p>
      <p className="text-xs text-ink-weak">
        予定: {scheduledStart}〜{scheduledEnd}
      </p>

      {isRecorded && !isEditing && (
        <div
          className="flex items-center justify-between rounded-[12px] px-3 py-2"
          style={{ background: "var(--color-success-soft)" }}
        >
          <span className="text-sm font-bold" style={{ color: "var(--color-success-ink)" }}>
            {matchesSchedule ? "予定通り記録しました" : `${recordedStart}〜${recordedEnd}で記録しました`}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-bold"
            style={{ color: "var(--color-success-ink)" }}
          >
            修正する
          </button>
        </div>
      )}

      {(!isRecorded || isEditing) && (
        <>
          {!isEditing && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => record(scheduledStart, scheduledEnd)}
              className="rounded-full px-5 py-3 text-sm font-bold font-heading text-white disabled:opacity-50"
              style={{ background: "var(--color-primary)" }}
            >
              {isPending ? "記録中..." : `予定通り(${scheduledStart}〜${scheduledEnd})`}
            </button>
          )}
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-primary-ink"
            >
              時間を変更する
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={actualStart}
                  onChange={(e) => setActualStart(e.target.value)}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-base"
                />
                <span className="text-ink-weak">〜</span>
                <input
                  type="time"
                  value={actualEnd}
                  onChange={(e) => setActualEnd(e.target.value)}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-base"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => record(actualStart, actualEnd)}
                  className="flex-1 rounded-full px-4 py-2 text-sm font-bold font-heading text-white disabled:opacity-50"
                  style={{ background: "var(--color-primary)" }}
                >
                  {isPending ? "記録中..." : "この内容で記録する"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-full border border-border px-4 py-2 text-sm text-ink-weak"
                >
                  やめる
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
