// Generates a VAPID key pair for Web Push (RFC 8292): a 65-byte uncompressed
// P-256 public key and the 32-byte private scalar, both base64url.
//   node scripts/generate-vapid-keys.mjs
// Public key  -> wrangler.jsonc "vars".VAPID_PUBLIC_KEY (safe to commit)
// Private key -> `npx wrangler secret put VAPID_PRIVATE_KEY` (never commit)
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const b64u = (b) => Buffer.from(b).toString("base64url");
const publicKey = b64u(Buffer.concat([Buffer.from([0x04]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]));

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
