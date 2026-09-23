// @vitest-environment node
import { describe, expect, it } from "vitest";
import { base64UrlDecode, base64UrlEncode, buildVapidAuthorization, encryptPayload } from "@/lib/push/encrypt";

// RFC 8291 Appendix A — the one authoritative vector for aes128gcm Web Push.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

async function ecdhKeyPair(publicB64: string, privateB64: string): Promise<CryptoKeyPair> {
  const point = base64UrlDecode(publicB64);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(point.slice(1, 33)),
    y: base64UrlEncode(point.slice(33, 65)),
  };
  const params = { name: "ECDH", namedCurve: "P-256" };
  return {
    publicKey: await crypto.subtle.importKey("jwk", jwk, params, true, []),
    privateKey: await crypto.subtle.importKey("jwk", { ...jwk, d: privateB64 }, params, true, ["deriveBits"]),
  };
}

describe("encryptPayload", () => {
  it("reproduces the RFC 8291 Appendix A ciphertext exactly", async () => {
    const body = await encryptPayload(new TextEncoder().encode(RFC.plaintext), RFC.uaPublic, RFC.authSecret, {
      senderKeyPair: await ecdhKeyPair(RFC.asPublic, RFC.asPrivate),
      salt: base64UrlDecode(RFC.salt),
    });
    expect(base64UrlEncode(body)).toBe(RFC.body);
  });

  it("round-trips with a random sender key: the recipient can decrypt what was sent", async () => {
    const recipient = await ecdhKeyPair(RFC.uaPublic, RFC.uaPrivate);
    const body = await encryptPayload(new TextEncoder().encode("シフトが更新されました"), RFC.uaPublic, RFC.authSecret);

    // Parse header block: salt(16) | rs(4) | idlen(1) | keyid | ciphertext
    const salt = body.slice(0, 16);
    const idLen = body[20];
    const senderPublic = body.slice(21, 21 + idLen);
    const ciphertext = body.slice(21 + idLen);

    const senderKey = await crypto.subtle.importKey("raw", senderPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: senderKey }, recipient.privateKey, 256));
    const enc = new TextEncoder();
    const uaPublic = base64UrlDecode(RFC.uaPublic);
    const keyInfo = new Uint8Array([...enc.encode("WebPush: info\0"), ...uaPublic, ...senderPublic]);
    const hk = async (s: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, n: number) =>
      new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: "HKDF", hash: "SHA-256", salt: s, info },
          await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]),
          n * 8,
        ),
      );
    const ikm = await hk(base64UrlDecode(RFC.authSecret), ecdh, keyInfo, 32);
    const cek = await hk(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hk(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]),
        ciphertext,
      ),
    );

    expect(plain[plain.length - 1]).toBe(0x02);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe("シフトが更新されました");
  });

  it("rejects malformed subscription keys", async () => {
    await expect(encryptPayload(new Uint8Array([1]), "AAAA", RFC.authSecret)).rejects.toThrow("invalid p256dh");
    await expect(encryptPayload(new Uint8Array([1]), RFC.uaPublic, "AAAA")).rejects.toThrow("invalid auth secret");
  });
});

describe("buildVapidAuthorization", () => {
  it("produces a JWT that verifies against the VAPID public key and targets the endpoint's origin", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const publicB64 = base64UrlEncode(publicRaw);

    const header = await buildVapidAuthorization(
      "https://fcm.googleapis.com/fcm/send/abc123",
      "mailto:ops@example.com",
      publicB64,
      jwk.d!,
      1_700_000_000,
    );

    const match = header.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=(.+)$/);
    expect(match).not.toBeNull();
    const [, h, p, sig, k] = match!;
    expect(k).toBe(publicB64);
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(p)));
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: 1_700_000_000 + 43200, sub: "mailto:ops@example.com" });

    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      base64UrlDecode(sig),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });
});
