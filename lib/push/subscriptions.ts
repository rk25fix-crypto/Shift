import { and, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { toUserFacingError } from "@/lib/db/errors";
import { pushSubscriptions } from "@/drizzle/schema";
import { base64UrlDecode } from "@/lib/push/encrypt";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// The server POSTs to whatever endpoint a subscriber hands over, so an
// unchecked URL is a server-side request forgery primitive (any staff
// member could aim it at any URL). Browsers only ever hand out endpoints on
// their vendor's push service, so allow-list those hosts.
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome / Edge / Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /(^|\.)push\.apple\.com$/, // Safari / iOS home-screen apps
  /(^|\.)notify\.windows\.com$/, // legacy Edge / WNS
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && !url.port && PUSH_SERVICE_HOSTS.some((re) => re.test(url.hostname));
}

function hasValidKeys(p256dh: string, auth: string): boolean {
  try {
    const point = base64UrlDecode(p256dh);
    return point.length === 65 && point[0] === 0x04 && base64UrlDecode(auth).length === 16;
  } catch {
    return false;
  }
}

/**
 * Saves the calling staff device's push subscription. organizationId/staffId/
 * sessionId all come from the verified staff session (never from the
 * client). The upsert is keyed on `endpoint` alone, deliberately: the same
 * browser profile always gets the same endpoint back, so when a different
 * staff member (even in another org) subscribes on a shared device the row
 * must be taken over — otherwise the previous person's notifications would
 * keep landing on that phone. This is the one write in the app that is
 * intentionally allowed to overwrite another tenant's row, and only because
 * possessing an endpoint URL means holding the device it belongs to.
 */
export async function upsertPushSubscriptionCore(
  session: { sessionId: string; organizationId: string; staffId: string },
  input: PushSubscriptionInput,
): Promise<{ error: string | null }> {
  if (!isAllowedPushEndpoint(input.endpoint)) return { error: "この端末は通知に対応していません" };
  if (!hasValidKeys(input.p256dh, input.auth)) return { error: "通知の登録情報が正しくありません" };

  const { db } = getScopedDb(session.organizationId);
  try {
    await db
      .insert(pushSubscriptions)
      .values({
        organizationId: session.organizationId,
        staffId: session.staffId,
        staffSessionId: session.sessionId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          organizationId: session.organizationId,
          staffId: session.staffId,
          staffSessionId: session.sessionId,
          p256dh: input.p256dh,
          auth: input.auth,
        },
      });
  } catch (err) {
    return { error: toUserFacingError(err, "通知の登録に失敗しました") };
  }
  return { error: null };
}

/** Removes one of the calling staff member's own subscriptions — scoped to org AND staff, so an endpoint alone can't delete someone else's row. */
export async function deletePushSubscriptionCore(
  organizationId: string,
  staffId: string,
  endpoint: string,
): Promise<{ error: string | null }> {
  const { db } = getScopedDb(organizationId);
  try {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.organizationId, organizationId),
          eq(pushSubscriptions.staffId, staffId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );
  } catch (err) {
    return { error: toUserFacingError(err, "通知の解除に失敗しました") };
  }
  return { error: null };
}
