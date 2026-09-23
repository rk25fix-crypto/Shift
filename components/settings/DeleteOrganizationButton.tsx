"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrganization } from "@/lib/org/actions";

/** オーナー専用・危険操作。事業所名を打たせてからでないと削除できない(誤タップ対策)。 */
export function DeleteOrganizationButton({ organizationName }: { organizationName: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOrganization();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/signup");
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm font-bold"
        style={{ color: "var(--color-danger-ink)" }}
      >
        この事業所を削除する
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-[16px] border p-4"
      style={{ borderColor: "var(--color-danger-border)", background: "var(--color-danger-soft)" }}
    >
      <p className="text-sm font-bold" style={{ color: "var(--color-danger-ink)" }}>
        本当に削除しますか?
      </p>
      <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>
        スタッフ・シフト・給与などすべてのデータがこの事業所から見えなくなります。確認のため、事業所名「{organizationName}」を入力してください。
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        aria-label="事業所名(確認用)"
        className="rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--color-danger-border)" }}
      />
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending || confirmText !== organizationName}
          onClick={handleDelete}
          className="flex-1 rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "var(--color-danger-ink-strong)" }}
        >
          {isPending ? "削除中..." : "削除する"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setConfirmText("");
            setError(null);
          }}
          className="rounded-full border border-border px-4 py-2 text-sm text-ink-weak"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
