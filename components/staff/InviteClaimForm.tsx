"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimStaffInvite } from "@/lib/staff-auth/actions";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface InviteClaimFormProps {
  token: string;
  staffName: string;
  shiftTypes: ShiftTypeRecord[];
}

/** スタッフ本人が固定休・入れないシフトを入力して招待を受け取る(design handoff 2i)。名前は管理者側で登録済みのものを表示するだけ。 */
export function InviteClaimForm({ token, staffName, shiftTypes }: InviteClaimFormProps) {
  const [fixedDaysOff, setFixedDaysOff] = useState<number[]>([]);
  const [unavailableShiftTypeIds, setUnavailableShiftTypeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleDayOff(day: number) {
    setFixedDaysOff((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  function toggleUnavailable(shiftTypeId: string) {
    setUnavailableShiftTypeIds((ids) =>
      ids.includes(shiftTypeId) ? ids.filter((id) => id !== shiftTypeId) : [...ids, shiftTypeId],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error } = await claimStaffInvite(token, { fixedDaysOff, unavailableShiftTypeIds });
      if (error) setError(error);
      else router.replace("/staff-home");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-5">
      <div className="text-center">
        <p className="text-sm text-ink-weak">ようこそ</p>
        <h1 className="text-xl font-bold font-heading text-ink">{staffName}さん</h1>
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-bold text-ink">固定休(任意)</legend>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, day) => {
            const isOn = fixedDaysOff.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDayOff(day)}
                className="h-11 w-11 rounded-full border-2 text-sm font-bold"
                style={
                  isOn
                    ? { borderColor: "var(--color-primary)", background: "var(--color-primary)", color: "#fff" }
                    : { borderColor: "var(--color-border)", color: "var(--color-ink)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {shiftTypes.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-bold text-ink">入れないシフト(任意)</legend>
          <div className="flex flex-wrap gap-2">
            {shiftTypes.map((shiftType) => {
              const isOn = unavailableShiftTypeIds.includes(shiftType.id);
              return (
                <button
                  key={shiftType.id}
                  type="button"
                  onClick={() => toggleUnavailable(shiftType.id)}
                  className="rounded-full border-2 px-4 py-2 text-sm font-bold"
                  style={
                    isOn
                      ? { borderColor: "var(--color-danger-ink-strong)", background: "var(--color-danger-soft)", color: "var(--color-danger-ink)" }
                      : { borderColor: "var(--color-border)", color: "var(--color-ink)" }
                  }
                >
                  {shiftType.code}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {error && <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
        style={{ background: "var(--color-primary)" }}
      >
        {isPending ? "送信中..." : "はじめる"}
      </button>
    </form>
  );
}
