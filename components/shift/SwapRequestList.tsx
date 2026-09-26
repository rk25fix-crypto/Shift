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
    return <p className="px-4 py-6 text-sm text-ink-weak">交代申請はまだありません。</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
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

  const isPendingRequest = request.status === "pending";

  return (
    <li
      className="flex flex-col gap-2 rounded-[18px] px-4 py-4"
      style={
        isPendingRequest
          ? { border: "2px solid var(--color-primary)" }
          : { border: "1px solid transparent" }
      }
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ink-weak">{formatDateJapanese(request.date)}</p>
        <span className="text-xs font-bold text-ink-weakest">{STATUS_LABEL[request.status]}</span>
      </div>
      <p className="text-base text-ink">
        {sideLabel(fromName, request.fromShiftTypeId, shiftTypeLabelById)}
        {" ⇄ "}
        {sideLabel(toName, request.toShiftTypeId, shiftTypeLabelById)}
      </p>
      {error && (
        <p className="text-sm" style={{ color: "var(--color-danger-ink)" }}>
          {error}
        </p>
      )}
      {isPendingRequest && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecide("approved")}
            className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            承認する
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleDecide("rejected")}
            className="rounded-full border border-border px-4 py-2 text-sm text-ink-weak disabled:opacity-50"
          >
            却下する
          </button>
        </div>
      )}
    </li>
  );
}
