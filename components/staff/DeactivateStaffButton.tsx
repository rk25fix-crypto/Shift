"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateStaff } from "@/lib/staff/actions";

export function DeactivateStaffButton({ staffId }: { staffId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDeactivate() {
    if (!window.confirm("このスタッフを無効化しますか?過去のシフト記録は残ります。")) return;
    setError(null);
    startTransition(async () => {
      const result = await deactivateStaff(staffId);
      if (result.error) setError(result.error);
      else router.push("/staff");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleDeactivate}
        disabled={isPending}
        className="rounded-full border border-red-300 px-6 py-3 text-base font-medium text-red-600 disabled:opacity-50"
      >
        {isPending ? "処理中..." : "スタッフを無効化する"}
      </button>
    </div>
  );
}
