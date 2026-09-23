"use client";

import Link from "next/link";

/**
 * Catches lib/org/current.ts's requireCurrentMembership() throwing when the
 * logged-in user belongs to zero organizations — a reachable state after
 * deleting the org they were viewing (lib/org/actions.ts's
 * deleteOrganization), not only a truly unexpected error. Without this,
 * Next renders its generic error UI with no way back into the app.
 */
export default function AppError() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-ink-weak">
        表示できる事業所が見つかりませんでした。削除された、または所属していない可能性があります。
      </p>
      <Link
        href="/signup"
        className="rounded-full px-6 py-3 text-base font-bold font-heading text-white"
        style={{ background: "var(--color-primary)" }}
      >
        事業所を作成/選択する
      </Link>
    </main>
  );
}
