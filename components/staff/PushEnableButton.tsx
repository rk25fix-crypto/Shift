"use client";

import { useEffect, useState, useTransition } from "react";
import { subscribeOwnPush, unsubscribeOwnPush } from "@/lib/staff-auth/actions";
import { base64UrlDecode } from "@/lib/push/encrypt";

type Status = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

async function detectStatus(): Promise<Status> {
  // iOS only exposes Web Push to a web app launched from the Home Screen.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";

  // `ready` never resolves when no service worker is registered (dev server).
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  if (!registration) return "unsupported";

  const subscription = await registration.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

/** シフト確定・変更のプッシュ通知をこの端末で受け取る/やめる。許可ダイアログは必ずボタン操作から出す(iOS必須)。 */
export function PushEnableButton({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    detectStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setError(null);
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlDecode(vapidPublicKey),
        });
        const json = subscription.toJSON();
        const result = await subscribeOwnPush({
          endpoint: json.endpoint ?? "",
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        });
        if (result.error) {
          await subscription.unsubscribe();
          setError(result.error);
          return;
        }
        setStatus("on");
      } catch {
        setError("通知の設定に失敗しました。もう一度お試しください。");
      }
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribeOwnPush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setStatus("off");
      } catch {
        setError("通知の解除に失敗しました。もう一度お試しください。");
      }
    });
  }

  if (status === "loading" || status === "unsupported") return null;

  return (
    <div className="flex flex-col gap-2 rounded-[16px] border border-border bg-surface p-4">
      <p className="text-sm font-bold text-ink">シフトの通知</p>

      {status === "needs-install" && (
        <p className="text-xs text-ink-weak">
          通知を受け取るには、Safariの共有ボタンから「ホーム画面に追加」し、ホーム画面のアイコンから開いてください。
          ログイン画面が出たら、下の「ホーム画面アプリでログインする」のコードを入力します。
        </p>
      )}

      {status === "denied" && (
        <p className="text-xs text-ink-weak">
          通知がオフになっています。端末の設定アプリでShiftの通知を許可すると受け取れます。
        </p>
      )}

      {status === "off" && (
        <>
          <p className="text-xs text-ink-weak">シフトが確定・変更されたときにお知らせします。</p>
          <button
            type="button"
            disabled={isPending}
            onClick={enable}
            className="rounded-full px-5 py-3 text-sm font-bold font-heading text-white disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {isPending ? "設定中..." : "通知を受け取る"}
          </button>
        </>
      )}

      {status === "on" && (
        <div
          className="flex items-center justify-between rounded-[12px] px-3 py-2"
          style={{ background: "var(--color-success-soft)" }}
        >
          <span className="text-sm font-bold" style={{ color: "var(--color-success-ink)" }}>
            通知はオンです
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={disable}
            className="text-xs font-bold disabled:opacity-50"
            style={{ color: "var(--color-success-ink)" }}
          >
            オフにする
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger-ink)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
