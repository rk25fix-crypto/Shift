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
  /**
   * Where a successful *creation* (not edit) lands — "list" is the default
   * /staff, "invite" goes straight to the new staff's own detail page so a
   * manager coming from the「リンクを送る」空状態ボタン(design handoff 3c)
   * can issue an invite link immediately without an extra click.
   */
  afterCreateRedirect?: "list" | "invite";
}

export function StaffForm({
  existing,
  existingHourlyWage,
  shiftTypes,
  canEditCompensation,
  afterCreateRedirect = "list",
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
      if (existing) {
        const result = await updateStaff(existing.id, input);
        if (result.error) setError(result.error);
        else router.push("/staff");
        return;
      }
      const result = await createStaff(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(
        afterCreateRedirect === "invite" && result.staffId ? `/staff/${result.staffId}` : "/staff",
      );
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
          className="rounded-lg border border-border px-4 py-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        役割(任意、例: 主任・フリー)
        <input
          type="text"
          value={roleLabel}
          onChange={(e) => setRoleLabel(e.target.value)}
          className="rounded-lg border border-border px-4 py-3 text-base"
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
                "h-11 w-11 rounded-full border text-sm font-bold",
                fixedDaysOff.includes(day) ? "text-white" : "border-border text-ink-weak",
              )}
              style={
                fixedDaysOff.includes(day)
                  ? { background: "var(--color-primary)", borderColor: "var(--color-primary)" }
                  : undefined
              }
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
                className="rounded-full border px-4 py-2 text-sm font-bold"
                style={
                  unavailableShiftTypeIds.includes(shiftType.id)
                    ? {
                        borderColor: "var(--color-danger-border)",
                        background: "var(--color-danger-soft)",
                        color: "var(--color-danger-ink)",
                      }
                    : { borderColor: "var(--color-border)", color: "var(--color-ink-weak)" }
                }
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
            className="rounded-lg border border-border px-4 py-3 text-base"
          />
        </label>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full px-6 py-3 text-base font-bold font-heading text-white disabled:opacity-50"
        style={{ background: "var(--color-primary)" }}
      >
        {isPending ? "保存中..." : existing ? "更新する" : "追加する"}
      </button>
    </form>
  );
}
