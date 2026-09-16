"use client";

import { useState, useTransition } from "react";
import { createStaffInvite } from "@/lib/staff-invites/actions";

/** Admin-side "招待リンクを発行/再発行" — the link shown to a manager to hand to a staff member (LINE, メール等)。 */
export function InviteButton({ staffId }: { staffId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleIssue() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createStaffInvite(staffId);
      if (result.error) setError(result.error);
      else setUrl(result.url);
    });
  }

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("コピーに失敗しました。リンクを選択して手動でコピーしてください。");
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-[16px] border p-3"
      style={{ borderColor: "var(--color-info-border)", background: "var(--color-info-soft)" }}
    >
      <p className="text-sm font-bold" style={{ color: "var(--color-info-ink)" }}>
        招待リンク
      </p>
      <p className="text-xs" style={{ color: "var(--color-info-sub)" }}>
        LINE・メールでこのスタッフに送ると、本人が固定休・入れないシフトを入力できます。
      </p>
      {url && (
        <p className="break-all rounded-lg bg-surface px-3 py-2 text-xs text-ink">{url}</p>
      )}
      {error && <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleIssue}
          className="rounded-full border-2 px-4 py-2 text-xs font-bold disabled:opacity-50"
          style={{ borderColor: "var(--color-info-strong)", color: "var(--color-info-ink)" }}
        >
          {isPending ? "発行中..." : url ? "リンクを再発行" : "リンクを発行"}
        </button>
        {url && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full px-4 py-2 text-xs font-bold text-white"
            style={{ background: "var(--color-info-strong)" }}
          >
            {copied ? "コピーしました" : "リンクをコピー"}
          </button>
        )}
      </div>
    </div>
  );
}
