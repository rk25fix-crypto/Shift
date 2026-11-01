import { and, eq, gt, inArray } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { pushSubscriptions, staffSessions } from "@/drizzle/schema";
import { buildVapidAuthorization, encryptPayload } from "@/lib/push/encrypt";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Null when VAPID isn't configured (local dev, CI, d1 tests) — every caller then quietly does nothing. */
export function getPushConfig(): PushConfig | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return null;
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
}

interface SendDeps {
  config?: PushConfig | null;
  fetch?: typeof fetch;
}

/**
 * Pushes `payload` to every live device of the given staff. Best-effort by
 * design: a notification failing must never fail (or be awaited by) the
 * shift change that triggered it, so nothing here throws. A 404/410 from the
 * push service means the subscription is dead (app uninstalled, permission
 * revoked) and the row is deleted.
 *
 * Only sessions that haven't expired are joined in: staff_sessions rows are
 * swept lazily (lib/staff-auth/session.ts), so an expired session's device
 * must not keep receiving notifications until someone deletes the row.
 */
export async function sendPushToStaff(
  organizationId: string,
  staffIds: string[],
  payload: PushPayload,
  deps: SendDeps = {},
): Promise<void> {
  const config = deps.config === undefined ? getPushConfig() : deps.config;
  if (!config || staffIds.length === 0) return;
  const doFetch = deps.fetch ?? fetch;

  try {
    const { db } = getScopedDb(organizationId);
    const subs = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .innerJoin(staffSessions, eq(staffSessions.id, pushSubscriptions.staffSessionId))
      .where(
        and(
          eq(pushSubscriptions.organizationId, organizationId),
          inArray(pushSubscriptions.staffId, staffIds),
          gt(staffSessions.expiresAt, new Date()),
        ),
      );
    if (subs.length === 0) return;

    const body = new TextEncoder().encode(JSON.stringify(payload));
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          const response = await doFetch(sub.endpoint, {
            method: "POST",
            headers: {
              "Content-Encoding": "aes128gcm",
              "Content-Type": "application/octet-stream",
              TTL: "86400",
              Urgency: "normal",
              Authorization: await buildVapidAuthorization(
                sub.endpoint,
                config.subject,
                config.publicKey,
                config.privateKey,
              ),
            },
            body: (await encryptPayload(body, sub.p256dh, sub.auth)) as BodyInit,
            signal: AbortSignal.timeout(8000),
          });
          if (response.status === 404 || response.status === 410) {
            await db
              .delete(pushSubscriptions)
              .where(and(eq(pushSubscriptions.organizationId, organizationId), eq(pushSubscriptions.id, sub.id)));
          }
        } catch (err) {
          console.error("[push] send failed", err);
        }
      }),
    );
  } catch (err) {
    console.error("[push] sendPushToStaff failed", err);
  }
}

/**
 * Fire-and-forget from inside a Server Action / core: runs the send after
 * the response is flushed (vinext's `after()` → ctx.waitUntil, which is what
 * keeps a Workers isolate alive past the response) so a week's worth of
 * notifications doesn't add seconds to the manager's tap. `next/server` is
 * imported lazily so callers that never have VAPID configured (d1 tests, CI)
 * don't load it at all; outside a request scope (`after()` throws) it falls
 * back to a plain un-awaited promise.
 */
export async function scheduleStaffPush(
  organizationId: string,
  staffIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (!getPushConfig() || staffIds.length === 0) return;
  const task = () => sendPushToStaff(organizationId, [...new Set(staffIds)], payload);
  try {
    const { after } = await import("next/server");
    after(task);
  } catch {
    void task();
  }
}

export const SHIFT_UPDATED_PUSH: PushPayload = {
  title: "シフトの更新",
  body: "シフトが更新されました。タップして確認できます。",
  url: "/staff-home",
};

export const SHIFT_CONFIRMED_PUSH: PushPayload = {
  title: "シフト確定",
  body: "新しいシフトが確定しました。タップして確認できます。",
  url: "/staff-home",
};
