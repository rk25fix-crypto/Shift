"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmDraftShifts, generateDraftShifts } from "@/lib/shifts/generate-actions";

interface WeekAutoGenerateFabProps {
  startDate: string;
  endDateExclusive: string;
  hasRequiredShiftTypes: boolean;
  hasDrafts: boolean;
}

/**
 * Home-screen FAB that runs the week's auto-generate → confirm cycle in
 * place (design handoff 1b) — pressing it fills unassigned slots and the
 * label flips to "この週で確定する" instead of navigating to /week.
 */
export function WeekAutoGenerateFab({
  startDate,
  endDateExclusive,
  hasRequiredShiftTypes,
  hasDrafts: initialHasDrafts,
}: WeekAutoGenerateFabProps) {
  const [hasDrafts, setHasDrafts] = useState(initialHasDrafts);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  if (!hasRequiredShiftTypes) return null;

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      if (hasDrafts) {
        const result = await confirmDraftShifts(startDate, endDateExclusive);
        if (result.error) {
          setMessage(result.error);
          return;
        }
        setHasDrafts(false);
      } else {
        const result = await generateDraftShifts(startDate, endDateExclusive);
        if (result.error) {
          setMessage(result.error);
          return;
        }
        setHasDrafts(true);
      }
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-x-0 z-10 flex flex-col items-center gap-2"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 78px)" }}
    >
      {message && (
        <p className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink-weak shadow-sm">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="w-fit rounded-full px-5 py-3 text-sm font-bold font-heading text-white shadow-[0_6px_16px_rgba(196,96,31,.28)] disabled:opacity-60"
        style={{ background: "var(--color-primary)" }}
      >
        {isPending ? "組み立てています…" : hasDrafts ? "この週で確定する" : "この週を自動で組む"}
      </button>
    </div>
  );
}
