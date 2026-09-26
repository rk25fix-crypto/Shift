"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimPairingCode, createOwnPairingCode } from "@/lib/staff-auth/actions";

/**
 * ログイン済み(ブラウザ側)のスタッフが、ホーム画面に追加したアプリへログインを
 * 引き継ぐための10分コードを表示する。iOSではホーム画面アプリがSafariのCookieを
 * 共有しないため、招待リンク(使い切り)だけではホーム画面側でログインできない。
 */
export function PairingCodeIssuer() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function issue() {
    setError(null);
    startTransition(async () => {
      const result = await createOwnPairingCode();
      if (result.error) setError(result.error);
      else setCode(result.code);
    });
  }

  return (
    <details className="rounded-[16px] border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-bold text-ink">ホーム画面アプリでログインする</summary>
      <div className="mt-3 flex flex-col gap-2">
        <p className="text-xs text-ink-weak">
          ホーム画面に追加したアプリを開いてログイン画面が出たら、ここで出るコードを入力してください(10分間有効・1回のみ)。
        </p>
        {code && (
          <p className="rounded-lg bg-primary-soft px-3 py-3 text-center text-2xl font-bold tracking-widest text-primary-ink">
            {code.slice(0, 4)}-{code.slice(4)}
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={issue}
          className="rounded-full border border-border px-4 py-2 text-sm font-bold text-primary-ink disabled:opacity-50"
        >
          {isPending ? "発行中..." : code ? "コードを再発行" : "コードを表示"}
        </button>
      </div>
    </details>
  );
}

/** ログインしていない状態(ホーム画面アプリの初回起動など)で、PairingCodeIssuerのコードを入力する。 */
export function PairingCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await claimPairingCode(code);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-2">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        aria-label="引き継ぎコード"
        placeholder="ABCD-EFGH"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="rounded-lg border border-border px-3 py-3 text-center text-lg tracking-widest"
      />
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending || code.trim() === ""}
        className="rounded-full px-5 py-3 text-sm font-bold font-heading text-white disabled:opacity-50"
        style={{ background: "var(--color-primary)" }}
      >
        {isPending ? "確認中..." : "ログインする"}
      </button>
    </form>
  );
}
