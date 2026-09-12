"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideSwap } from "@/lib/swaps/actions";
import type { SwapRequestRecord } from "@/lib/swaps/queries";
import { formatDateJapanese } from "@/lib/date";

interface SwapRequestListProps {
  requests: SwapRequestRecord[];
  staffNameById: Map<string, string>;
  shiftTypeLabelById: Map<string, string>;
}

const STATUS_LABEL: Record<SwapRequestRecord["status"], string> = {
  pending: "未処理",
  approved: "承認済み",
  rejected: "却下済み",
};

function sideLabel(
  staffName: string,
  shiftTypeId: string | null,
  shiftTypeLabelById: Map<string, string>,
): string {
  const shiftLabel = shiftTypeId ? (shiftTypeLabelById.get(shiftTypeId) ?? "不明なシフト") : "休み";
  return `${staffName}(${shiftLabel})`;
}

export function SwapRequestList({ requests, staffNameById, shiftTypeLabelById }: SwapRequestListProps) {
  if (requests.length === 0) {
    return <p className="px-4 py-6 text-sm text-gray-500">交代申請はまだありません。</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {requests.map((request) => (
        <SwapRequestRow
          key={request.id}
          request={request}
          staffNameById={staffNameById}
          shiftTypeLabelById={shiftTypeLabelById}
        />
      ))}
    </ul>
  );
}

function SwapRequestRow({
  request,
  staffNameById,
  shiftTypeLabelById,
}: {
  request: SwapRequestRecord;
  staffNameById: Map<string, string>;
  shiftTypeLabelById: Map<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const fromName = staffNameById.get(request.fromStaffId) ?? "不明なスタッフ";
  const toName = staffNameById.get(request.toStaffId) ?? "不明なスタッフ";

  function handleDecide(decision: "approved" | "rejected") {
    if (decision === "approved" && !window.confirm("この内容でシフトを交代しますか?")) return;
    setError(null);
    startTransition(async () => {
      const result = await decideSwap(request.id, decision);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{formatDateJapanese(request.date)}</p>
        <span className="text-xs font-medium text-gray-400">{STATUS_LABEL[request.status]}</span>
      </div>
      <p className="text-base">
        {sideLabel(fromName, request.fromShiftTypeId, shiftTypeLabelById)}
        {" ⇄ "}
        {sideLabel(toName, request.toShiftTypeId, shiftTypeLabelById)}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {request.status === "pending" && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecide("approved")}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            承認する
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecide("rejected")}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
          >
            却下する
          </button>
        </div>
      )}
    </li>
  );
}
