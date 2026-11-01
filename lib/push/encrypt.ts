/**
 * Web Push payload encryption (RFC 8291, "aes128gcm" content coding) and the
 * VAPID JWT (RFC 8292) — WebCrypto only, so it runs on Cloudflare Workers
 * where the `web-push` npm package (Node https/crypto) is not a safe bet.
 * Verified against the RFC 8291 Appendix A vector in encrypt.test.ts.
 */

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** WebCrypto's HKDF does Extract(salt, ikm) then Expand(info, length) in one call. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

export interface EncryptOptions {
  /** Test-only: fixed sender key pair / salt so the RFC 8291 vector is reproducible. */
  senderKeyPair?: CryptoKeyPair;
  salt?: Uint8Array;
}

/**
 * Encrypts `plaintext` for one subscription. `userAgentPublicKey` is the
 * subscription's `p256dh` (65-byte uncompressed P-256 point) and `authSecret`
 * its `auth` (16 bytes), both base64url as PushSubscription.toJSON() gives
 * them. Returns the full request body: header block + single record.
 */
export async function encryptPayload(
  plaintext: Uint8Array,
  userAgentPublicKey: string,
  authSecret: string,
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  const uaPublic = base64UrlDecode(userAgentPublicKey);
  const auth = base64UrlDecode(authSecret);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("invalid p256dh");
  if (auth.length !== 16) throw new Error("invalid auth secret");

  const senderKeyPair =
    options.senderKeyPair ??
    ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));

  const senderPublic = new Uint8Array((await crypto.subtle.exportKey("raw", senderKeyPair.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, senderKeyPair.privateKey, 256),
  );

  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, senderPublic);
  const ikm = await hkdf(auth, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  // 0x02 = "this is the last record" padding delimiter; a single record is
  // plenty for a notification-sized payload (push services cap at ~4KB).
  const record = concat(plaintext, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, record as BufferSource),
  );

  const recordSize = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096, big-endian
  return concat(salt, recordSize, new Uint8Array([senderPublic.length]), senderPublic, ciphertext);
}

/** Imports the VAPID key pair (`publicKey` = 65-byte point, `privateKey` = 32-byte scalar, both base64url) for ES256 signing. */
async function importVapidSigningKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const point = base64UrlDecode(publicKey);
  if (point.length !== 65 || point[0] !== 0x04) throw new Error("invalid VAPID public key");
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(point.slice(1, 33)),
      y: base64UrlEncode(point.slice(33, 65)),
      d: privateKey,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** `Authorization` header value for a push request to `endpoint` (RFC 8292 "vapid" scheme). */
export async function buildVapidAuthorization(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: nowSeconds + 12 * 60 * 60, // spec maximum is 24h
        sub: subject,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const key = await importVapidSigningKey(publicKey, privateKey);
  // WebCrypto ECDSA returns raw r||s, which is exactly the JWS ES256 format.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(signingInput)),
  );
  return `vapid t=${signingInput}.${base64UrlEncode(signature)}, k=${publicKey}`;
}
