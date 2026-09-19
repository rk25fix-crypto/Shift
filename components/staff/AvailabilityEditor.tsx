"use client";

import { useState, useTransition } from "react";
import { updateOwnAvailability } from "@/lib/staff-auth/actions";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface AvailabilityEditorProps {
  shiftTypes: ShiftTypeRecord[];
  initialFixedDaysOff: number[];
  initialUnavailableShiftTypeIds: string[];
}

/** 固定休・入れないシフトを招待受諾後もいつでも見直せる編集欄(design handoff 1cの「自分の情報の入力残り」に対応)。 */
export function AvailabilityEditor({
  shiftTypes,
  initialFixedDaysOff,
  initialUnavailableShiftTypeIds,
}: AvailabilityEditorProps) {
  const [fixedDaysOff, setFixedDaysOff] = useState(initialFixedDaysOff);
  const [unavailableShiftTypeIds, setUnavailableShiftTypeIds] = useState(initialUnavailableShiftTypeIds);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleDayOff(day: number) {
    setSaved(false);
    setFixedDaysOff((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  function toggleUnavailable(shiftTypeId: string) {
    setSaved(false);
    setUnavailableShiftTypeIds((ids) =>
      ids.includes(shiftTypeId) ? ids.filter((id) => id !== shiftTypeId) : [...ids, shiftTypeId],
    );
  }

  function handleSave() {
    startTransition(async () => {
      const { error } = await updateOwnAvailability({ fixedDaysOff, unavailableShiftTypeIds });
      if (!error) setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-border bg-success-soft p-3">
      <p className="text-xs font-bold" style={{ color: "var(--color-success-ink)" }}>
        自分の情報
      </p>
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 text-xs text-ink-weak">固定休</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, day) => {
            const isOn = fixedDaysOff.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDayOff(day)}
                className="h-9 w-9 rounded-full border-2 text-xs font-bold"
                style={
                  isOn
                    ? { borderColor: "var(--color-primary)", background: "var(--color-primary)", color: "#fff" }
                    : { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink)" }
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
          <legend className="mb-1 text-xs text-ink-weak">入れないシフト</legend>
          <div className="flex flex-wrap gap-1.5">
            {shiftTypes.map((shiftType) => {
              const isOn = unavailableShiftTypeIds.includes(shiftType.id);
              return (
                <button
                  key={shiftType.id}
                  type="button"
                  onClick={() => toggleUnavailable(shiftType.id)}
                  className="rounded-full border-2 px-3 py-1.5 text-xs font-bold"
                  style={
                    isOn
                      ? { borderColor: "var(--color-danger-ink-strong)", background: "var(--color-danger-soft)", color: "var(--color-danger-ink)" }
                      : { borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink)" }
                  }
                >
                  {shiftType.code}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={handleSave}
        className="self-start rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        style={{ background: "var(--color-success-strong)" }}
      >
        {isPending ? "保存中..." : saved ? "保存しました" : "保存する"}
      </button>
    </div>
  );
}
