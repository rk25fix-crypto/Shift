"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteShiftType } from "@/lib/shift-types/actions";

export function DeleteShiftTypeButton({ shiftTypeId }: { shiftTypeId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm("このシフト種別を削除しますか?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteShiftType(shiftTypeId);
      if (result.error) setError(result.error);
      else router.push("/settings/shift-types");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-full border border-red-300 px-6 py-3 text-base font-medium text-red-600 disabled:opacity-50"
      >
        {isPending ? "削除中..." : "削除する"}
      </button>
    </div>
  );
}
