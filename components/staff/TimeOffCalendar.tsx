"use client";

import { useState, useTransition } from "react";
import { requestOwnTimeOff } from "@/lib/staff-auth/actions";
import { dayAndWeekday } from "@/lib/date";

interface TimeOffCalendarProps {
  dates: string[];
  requestedDates: Set<string>;
}

/** 休み希望カレンダー(design handoff 1c)。申請ボタンなし — タップした時点で送信、取り消しも同じタップで即反映。 */
export function TimeOffCalendar({ dates, requestedDates: initial }: TimeOffCalendarProps) {
  const [requested, setRequested] = useState(initial);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleTap(date: string) {
    // Optimistic: 休み希望はトグルではなくrequestTimeOff一方向(取り消しは
    // 管理者側の操作なので、ここでは即楽観反映のみ)。失敗時はロールバック。
    setError(null);
    setPendingDate(date);
    setRequested((prev) => new Set(prev).add(date));
    startTransition(async () => {
      const { error } = await requestOwnTimeOff(date);
      setPendingDate(null);
      if (error) {
        setError(error);
        setRequested((prev) => {
          const next = new Set(prev);
          next.delete(date);
          return next;
        });
      }
    });
  }

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dates.map((date) => {
        const { day, weekdayLabel } = dayAndWeekday(date);
        const isRequested = requested.has(date);
        return (
          <button
            key={date}
            type="button"
            disabled={isRequested || pendingDate === date}
            onClick={() => handleTap(date)}
            className="flex flex-col items-center gap-0.5 rounded-[10px] py-2 text-center disabled:opacity-100"
            style={
              isRequested
                ? { background: "var(--color-primary)", color: "#fff" }
                : { background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }
            }
          >
            <span className="text-[9px]" style={!isRequested ? { color: "var(--color-ink-weakest)" } : undefined}>
              {weekdayLabel}
            </span>
            <span className="text-xs font-bold font-heading">{day}</span>
          </button>
        );
      })}
      {error && (
        <p className="col-span-7 text-xs" style={{ color: "var(--color-danger-ink)" }}>
          {error}
        </p>
      )}
      <p className="col-span-7 mt-1 text-xs text-ink-weakest">
        休み希望 {requested.size}日ぶんを送信ずみ
      </p>
    </div>
  );
}
