import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getRawDb } from "@/lib/db/raw";
import { organizations, pushSubscriptions, staff, staffInvites, staffSessions } from "@/drizzle/schema";
import { base64UrlEncode } from "@/lib/push/encrypt";
import {
  deletePushSubscriptionCore,
  isAllowedPushEndpoint,
  upsertPushSubscriptionCore,
} from "@/lib/push/subscriptions";
import { sendPushToStaff, type PushConfig } from "@/lib/push/send";
import { deactivateStaffCore } from "@/lib/staff/write";
import {
  claimInviteCore,
  claimPairingCodeCore,
  createInviteCore,
  createPairingCodeCore,
} from "@/lib/staff-invites/write";

/**
 * Tenant isolation + lifecycle for Web Push subscriptions and the staff
 * pairing code (lib/push/*, lib/staff-invites/write.ts). Runs in the D1
 * suite (npm run test:d1) because every guarantee here is a query filter or
 * an ON DELETE CASCADE that only a real D1 exercises.
 */

const PAYLOAD = { title: "t", body: "b", url: "/staff-home" };

let orgX: { id: string };
let orgY: { id: string };
let staffX: { id: string };
let staffY: { id: string };
let config: PushConfig;

async function subscriptionKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const p256dh = base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const auth = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
  return { p256dh, auth };
}

async function makeSession(orgId: string, staffId: string, expiresAt = new Date(Date.now() + 3_600_000)) {
  const [row] = await getRawDb()
    .insert(staffSessions)
    .values({ organizationId: orgId, staffId, token: crypto.randomUUID(), expiresAt })
    .returning({ id: staffSessions.id });
  return { sessionId: row.id, organizationId: orgId, staffId };
}

let endpointCounter = 0;
const newEndpoint = () => `https://fcm.googleapis.com/fcm/send/test-${++endpointCounter}`;

async function subscribe(session: Awaited<ReturnType<typeof makeSession>>, endpoint = newEndpoint()) {
  const result = await upsertPushSubscriptionCore(session, { endpoint, ...(await subscriptionKeys()) });
  expect(result.error).toBeNull();
  return endpoint;
}

const rowsFor = (endpoint: string) =>
  getRawDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));

beforeAll(async () => {
  const db = getRawDb();
  [orgX] = await db.insert(organizations).values({ name: "通知X" }).returning({ id: organizations.id });
  [orgY] = await db.insert(organizations).values({ name: "通知Y" }).returning({ id: organizations.id });
  [staffX] = await db.insert(staff).values({ organizationId: orgX.id, name: "通知太郎" }).returning({ id: staff.id });
  [staffY] = await db.insert(staff).values({ organizationId: orgY.id, name: "通知花子" }).returning({ id: staff.id });

  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  config = {
    publicKey: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
    privateKey: jwk.d!,
    subject: "https://example.com",
  };
});

describe("isAllowedPushEndpoint (SSRF guard)", () => {
  it("accepts the real push services' hosts", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(true);
    }
  });

  it("rejects everything else: plain http, look-alike hosts, internal targets, ports, garbage", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evil.com/fcm.googleapis.com",
      "https://evilpush.apple.com.attacker.io/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://fcm.googleapis.com:8443/x",
      "not a url",
      "",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(false);
    }
  });
});

describe("upsertPushSubscriptionCore", () => {
  it("rejects a disallowed endpoint and malformed keys without writing anything", async () => {
    const session = await makeSession(orgX.id, staffX.id);
    const keys = await subscriptionKeys();

    const badEndpoint = await upsertPushSubscriptionCore(session, { endpoint: "https://evil.example.com/x", ...keys });
    expect(badEndpoint.error).toBe("この端末は通知に対応していません");

    const endpoint = newEndpoint();
    const badKeys = await upsertPushSubscriptionCore(session, { endpoint, p256dh: "AAAA", auth: keys.auth });
    expect(badKeys.error).toBe("通知の登録情報が正しくありません");
    expect(await rowsFor(endpoint)).toHaveLength(0);
  });

  it("re-subscribing the same endpoint updates in place (one row)", async () => {
    const session = await makeSession(orgX.id, staffX.id);
    const endpoint = await subscribe(session);
    await subscribe(session, endpoint);
    expect(await rowsFor(endpoint)).toHaveLength(1);
  });

  it("takes an endpoint over when a different staff member (another org) subscribes on the same device", async () => {
    const endpoint = await subscribe(await makeSession(orgX.id, staffX.id));
    await subscribe(await makeSession(orgY.id, staffY.id), endpoint);

    const rows = await rowsFor(endpoint);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ organizationId: orgY.id, staffId: staffY.id });

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    await sendPushToStaff(orgX.id, [staffX.id], PAYLOAD, { config, fetch: fetchMock });
    expect(fetchMock.mock.calls.filter(([url]) => url === endpoint)).toHaveLength(0);
  });
});

describe("deletePushSubscriptionCore", () => {
  it("cannot delete another staff member's or another org's subscription by endpoint alone", async () => {
    const endpoint = await subscribe(await makeSession(orgX.id, staffX.id));

    await deletePushSubscriptionCore(orgY.id, staffY.id, endpoint);
    await deletePushSubscriptionCore(orgX.id, staffY.id, endpoint);
    expect(await rowsFor(endpoint)).toHaveLength(1);

    await deletePushSubscriptionCore(orgX.id, staffX.id, endpoint);
    expect(await rowsFor(endpoint)).toHaveLength(0);
  });
});

describe("sendPushToStaff", () => {
  it("only reaches the requested staff in the requested org, with an encrypted VAPID-signed request", async () => {
    const ownEndpoint = await subscribe(await makeSession(orgX.id, staffX.id));
    const otherEndpoint = await subscribe(await makeSession(orgY.id, staffY.id));

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    await sendPushToStaff(orgX.id, [staffX.id], PAYLOAD, { config, fetch: fetchMock });

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain(ownEndpoint);
    expect(urls).not.toContain(otherEndpoint);

    const [, init] = fetchMock.mock.calls.find(([url]) => url === ownEndpoint)!;
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(init.headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect(new TextDecoder().decode(init.body)).not.toContain("シフト"); // ciphertext, not plaintext
  });

  it("never sends to a staffId from another org, even when the caller passes it", async () => {
    const otherEndpoint = await subscribe(await makeSession(orgY.id, staffY.id));
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await sendPushToStaff(orgX.id, [staffY.id], PAYLOAD, { config, fetch: fetchMock });
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(otherEndpoint);
  });

  it("deletes a subscription the push service reports gone (410/404), keeps it on other failures", async () => {
    const session = await makeSession(orgX.id, staffX.id);
    const gone = await subscribe(session);
    const flaky = await subscribe(session);
    const broken = await subscribe(session);

    const fetchMock = vi.fn(async (url: string) => {
      if (url === gone) return new Response(null, { status: 410 });
      if (url === flaky) return new Response(null, { status: 500 });
      throw new Error("network down");
    });
    await expect(
      sendPushToStaff(orgX.id, [staffX.id], PAYLOAD, { config, fetch: fetchMock as unknown as typeof fetch }),
    ).resolves.toBeUndefined();

    expect(await rowsFor(gone)).toHaveLength(0);
    expect(await rowsFor(flaky)).toHaveLength(1);
    expect(await rowsFor(broken)).toHaveLength(1);
  });

  it("skips devices whose staff session has expired", async () => {
    const expired = await subscribe(await makeSession(orgX.id, staffX.id, new Date(Date.now() - 1000)));
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await sendPushToStaff(orgX.id, [staffX.id], PAYLOAD, { config, fetch: fetchMock });
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(expired);
  });

  it("is a silent no-op without VAPID config", async () => {
    await subscribe(await makeSession(orgX.id, staffX.id));
    const fetchMock = vi.fn();
    await sendPushToStaff(orgX.id, [staffX.id], PAYLOAD, { config: null, fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("subscription lifecycle follows the staff session", () => {
  it("deactivating a staff member removes their subscriptions", async () => {
    const [victim] = await getRawDb()
      .insert(staff)
      .values({ organizationId: orgX.id, name: "退職者" })
      .returning({ id: staff.id });
    const endpoint = await subscribe(await makeSession(orgX.id, victim.id));

    await deactivateStaffCore(orgX.id, victim.id);
    expect(await rowsFor(endpoint)).toHaveLength(0);
  });

  it("re-issuing an invite (lost device) removes the old device's subscriptions", async () => {
    const [target] = await getRawDb()
      .insert(staff)
      .values({ organizationId: orgX.id, name: "再発行対象" })
      .returning({ id: staff.id });
    const endpoint = await subscribe(await makeSession(orgX.id, target.id));

    const issued = await createInviteCore(orgX.id, target.id);
    expect(issued.error).toBeNull();
    expect(await rowsFor(endpoint)).toHaveLength(0);
  });
});

describe("pairing code (home-screen app login handoff)", () => {
  it("issues a code, exchanges it once for a session for the right staff, and leaves existing sessions alone", async () => {
    const existing = await makeSession(orgX.id, staffX.id);
    const issued = await createPairingCodeCore(orgX.id, staffX.id);
    if (issued.error) throw new Error(issued.error);
    expect(issued.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    // typed with a hyphen and lowercase, as a person would
    const typed = `${issued.code.slice(0, 4)}-${issued.code.slice(4)}`.toLowerCase();
    const claimed = await claimPairingCodeCore(typed);
    if ("error" in claimed) throw new Error(claimed.error);
    expect(claimed).toMatchObject({ organizationId: orgX.id, staffId: staffX.id });

    const again = await claimPairingCodeCore(issued.code);
    expect(again).toEqual({ error: "コードが見つからないか、期限切れです" });

    const stillThere = await getRawDb().select().from(staffSessions).where(eq(staffSessions.id, existing.sessionId));
    expect(stillThere).toHaveLength(1);
  });

  it("a newer code replaces the previous unclaimed one", async () => {
    const first = await createPairingCodeCore(orgX.id, staffX.id);
    const second = await createPairingCodeCore(orgX.id, staffX.id);
    if (first.error || second.error) throw new Error("issue failed");

    expect(await claimPairingCodeCore(first.code)).toEqual({ error: "コードが見つからないか、期限切れです" });
    expect("error" in (await claimPairingCodeCore(second.code))).toBe(false);
  });

  it("refuses an expired code", async () => {
    const issued = await createPairingCodeCore(orgX.id, staffX.id);
    if (issued.error) throw new Error(issued.error);
    await getRawDb()
      .update(staffInvites)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(staffInvites.token, issued.code));

    expect(await claimPairingCodeCore(issued.code)).toEqual({ error: "コードが見つからないか、期限切れです" });
  });

  it("refuses to issue a code for another org's staff member", async () => {
    const issued = await createPairingCodeCore(orgX.id, staffY.id);
    expect(issued).toEqual({ code: null, error: "スタッフが見つかりません" });
    const rows = await getRawDb().select().from(staffInvites).where(eq(staffInvites.staffId, staffY.id));
    expect(rows.filter((r) => r.kind === "pairing" && r.organizationId === orgX.id)).toHaveLength(0);
  });

  it("refuses to exchange a code whose staff member was deactivated after it was issued", async () => {
    const [gone] = await getRawDb()
      .insert(staff)
      .values({ organizationId: orgY.id, name: "無効化済み" })
      .returning({ id: staff.id });
    const issued = await createPairingCodeCore(orgY.id, gone.id);
    if (issued.error) throw new Error(issued.error);
    await getRawDb().update(staff).set({ isActive: false }).where(eq(staff.id, gone.id));

    expect(await claimPairingCodeCore(issued.code)).toEqual({ error: "コードが見つからないか、期限切れです" });
    const sessions = await getRawDb().select().from(staffSessions).where(eq(staffSessions.staffId, gone.id));
    expect(sessions).toHaveLength(0);
  });

  it("pairing codes and invite tokens are not interchangeable", async () => {
    const invite = await createInviteCore(orgY.id, staffY.id);
    const pairing = await createPairingCodeCore(orgY.id, staffY.id);
    if (invite.error || pairing.error) throw new Error("issue failed");

    expect(await claimPairingCodeCore(invite.token)).toEqual({ error: "コードが見つからないか、期限切れです" });
    expect(
      await claimInviteCore(pairing.code, { fixedDaysOff: [], unavailableShiftTypeIds: [] }),
    ).toEqual({ error: "招待リンクが見つかりません" });
    // and the invite is still claimable the normal way
    expect(
      "error" in (await claimInviteCore(invite.token, { fixedDaysOff: [], unavailableShiftTypeIds: [] })),
    ).toBe(false);
  });

  it("only ever creates a staff_invites row scoped to the requesting org", async () => {
    const issued = await createPairingCodeCore(orgX.id, staffX.id);
    if (issued.error) throw new Error(issued.error);
    const [row] = await getRawDb()
      .select()
      .from(staffInvites)
      .where(and(eq(staffInvites.token, issued.code), eq(staffInvites.kind, "pairing")));
    expect(row).toMatchObject({ organizationId: orgX.id, staffId: staffX.id });
  });
});
