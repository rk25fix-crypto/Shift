"use client";

import { useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "shift:install-prompt-dismissed-at";

function subscribe() {
  // Nothing external changes after mount; the snapshot only needs to be
  // read once per load, so there's nothing to subscribe to.
  return () => {};
}

/**
 * iOS Safari has no `beforeinstallprompt` API, so there is no native way to
 * ask a user to install the PWA — without this banner, a non-technical
 * manager has no path to "ホーム画面に追加" at all (docs/plan.md, "PWA固有
 * の対応"). Shown once per session, re-offered after a few days if still
 * not installed.
 *
 * Read via useSyncExternalStore (not an effect + setState) so the
 * browser-only check doesn't cause a post-mount re-render, and so the
 * server snapshot (always hidden) matches what SSR actually renders.
 */
function getShouldOfferInstallSnapshot(): boolean {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (!isIos || isStandalone) return false;

  let dismissedAt = 0;
  try {
    dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
  } catch {
    // localStorage unavailable (private mode) — treat as never dismissed.
  }
  const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  if (dismissedAt && daysSinceDismissed < 3) return false;

  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function InstallPromptBanner() {
  const shouldOffer = useSyncExternalStore(
    subscribe,
    getShouldOfferInstallSnapshot,
    getServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);

  if (!shouldOffer || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable (private mode) — just hide for this session.
    }
    setDismissed(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-gray-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-lg">
      <p className="text-sm font-medium">ホーム画面に追加すると、アプリのように使えます</p>
      <ol className="list-inside list-decimal text-sm text-gray-600">
        <li>画面下の共有ボタン(□に↑)をタップ</li>
        <li>「ホーム画面に追加」を選択</li>
        <li>右上の「追加」をタップ</li>
      </ol>
      <button
        type="button"
        onClick={dismiss}
        className="self-end text-sm text-indigo-600"
      >
        閉じる
      </button>
    </div>
  );
}
