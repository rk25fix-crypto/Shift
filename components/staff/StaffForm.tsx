"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createStaff, updateStaff, type StaffInput } from "@/lib/staff/actions";
import type { StaffRecord } from "@/lib/staff/queries";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface StaffFormProps {
  /** Present when editing an existing staff member; absent when creating one. */
  existing?: StaffRecord;
  existingHourlyWage?: number | null;
  shiftTypes: ShiftTypeRecord[];
  /** 時給欄はownerにしか表示しない(docs/plan.md 「時給をstaffから分離する理由」)。 */
  canEditCompensation: boolean;
}

export function StaffForm({
  existing,
  existingHourlyWage,
  shiftTypes,
  canEditCompensation,
}: StaffFormProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [roleLabel, setRoleLabel] = useState(existing?.roleLabel ?? "");
  const [fixedDaysOff, setFixedDaysOff] = useState<number[]>(existing?.fixedDaysOff ?? []);
  const [unavailableShiftTypeIds, setUnavailableShiftTypeIds] = useState<string[]>(
    existing?.unavailableShiftTypeIds ?? [],
  );
  const [hourlyWage, setHourlyWage] = useState<string>(
    existingHourlyWage != null ? String(existingHourlyWage) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleDayOff(day: number) {
    setFixedDaysOff((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  }

  function toggleUnavailableShiftType(shiftTypeId: string) {
    setUnavailableShiftTypeIds((ids) =>
      ids.includes(shiftTypeId) ? ids.filter((id) => id !== shiftTypeId) : [...ids, shiftTypeId],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: StaffInput = {
      name,
      roleLabel,
      fixedDaysOff,
      unavailableShiftTypeIds,
      hourlyWage: canEditCompensation && hourlyWage !== "" ? Number(hourlyWage) : null,
    };

    startTransition(async () => {
      const result = existing ? await updateStaff(existing.id, input) : await createStaff(input);
      if (result.error) setError(result.error);
      else router.push("/staff");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 py-6">
      <label className="flex flex-col gap-1 text-sm">
        氏名
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        役割(任意、例: 主任・フリー)
        <input
          type="text"
          value={roleLabel}
          onChange={(e) => setRoleLabel(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">固定休</legend>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDayOff(day)}
              className={clsx(
                "h-11 w-11 rounded-full border text-sm font-medium",
                fixedDaysOff.includes(day)
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-300 text-gray-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {shiftTypes.length > 0 && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">入れないシフト(任意)</legend>
          <div className="flex flex-wrap gap-2">
            {shiftTypes.map((shiftType) => (
              <button
                key={shiftType.id}
                type="button"
                onClick={() => toggleUnavailableShiftType(shiftType.id)}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-medium",
                  unavailableShiftTypeIds.includes(shiftType.id)
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-300 text-gray-700",
                )}
              >
                {shiftType.code}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {canEditCompensation && (
        <label className="flex flex-col gap-1 text-sm">
          時給(円、任意)
          <input
            type="number"
            min={0}
            value={hourlyWage}
            onChange={(e) => setHourlyWage(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-base"
          />
        </label>
      )}

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
