"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return !navigator.onLine;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * オフライン中も操作は止めない、という方針の表示のみの帯
 * (design_handoff_shift_bright_flow/README.md 3b)。未送信データの実際の
 * オフラインキューイング(送信まち表示・再送)はここでは実装していない —
 * バナーで状態を伝えるところまでが今回のスコープ。
 */
export function OfflineBanner() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isOffline) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-bold"
      style={{ background: "var(--color-warn-soft)", color: "var(--color-warn-ink)" }}
    >
      <span aria-hidden className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--color-warn-dot)" }} />
      オフラインです。通信が回復するまで保存できません。
    </div>
  );
}
