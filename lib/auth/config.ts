import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { testUtils } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { Resend } from "resend";
import { getRawDb } from "@/lib/db/raw";
import * as authSchema from "@/drizzle/auth-schema";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Primary login path (docs/plan.md "認証方式"): a 6-digit code typed inside
 * the PWA, not a tapped link — iOS opens links in Safari, not the installed
 * home-screen app, which would leave the PWA logged out.
 *
 * `database` touches the raw D1 client directly because Better Auth's own
 * tables (user/session/account/verification) are global identity tables,
 * not tenant-scoped data — see eslint.config.mjs's allow-list for lib/db/raw.
 */
export const auth = betterAuth({
  database: drizzleAdapter(getRawDb(), {
    provider: "sqlite",
    schema: authSchema,
  }),
  emailAndPassword: { enabled: false },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") return;
        // E2E/local dev only (ENABLE_TEST_UTILS is never set in the deployed
        // Worker — it isn't in wrangler.jsonc's vars or a dashboard secret).
        // testUtils({ captureOTP: true }) below already captured this code
        // for app/api/test/otp/route.ts to read, so skip the real send —
        // tests shouldn't need a live Resend API key.
        if (process.env.ENABLE_TEST_UTILS === "true") return;
        // TODO(temporary diagnostic logging): the resend SDK returns
        // { data, error } rather than throwing on API-level failures, so a
        // plain `await ... .send(...)` silently swallows the actual reason
        // (invalid key, unverified domain, etc.) — log it explicitly until
        // the OTP email is confirmed working end-to-end in production.
        const result = await getResend().emails.send({
          // Resend's shared onboarding@resend.dev domain only delivers to
          // the account's own verified address until a custom domain is
          // added (https://resend.com/domains) — fine for the Phase 1a.5
          // pilot, but real customer sign-ups will need a verified domain
          // here before Phase 1.5.
          from: "Shift <onboarding@resend.dev>",
          to: email,
          subject: "Shift ログインコード",
          html: `<p>Shift へのログインコードです。</p><p style="font-size:32px;font-weight:700;letter-spacing:0.2em;">${otp}</p><p>アプリに戻り、このコードを入力してください。有効期限は5分です。</p><p style="color:#6b7280;font-size:13px;">心当たりがない場合は、このメールを破棄してください。</p>`,
        });
        if (result.error) {
          console.error("[Shift] Resend send failed:", JSON.stringify(result.error));
          throw new Error(`Resend send failed: ${result.error.message}`);
        }
      },
    }),
    // Captures every generated OTP into an in-memory map keyed by email, so
    // E2E tests can log in without a real inbox. Cheap and inert unless
    // something calls ctx.test.getOTP() — only getTestOtp() below does that,
    // and only app/api/test/otp/route.ts calls getTestOtp(), gated by the
    // same ENABLE_TEST_UTILS check as above.
    testUtils({ captureOTP: true }),
    // Must be last — auto-forwards Set-Cookie headers from auth.api.* calls
    // into Next.js's cookie jar when called from Server Actions.
    nextCookies(),
  ],
});

/** E2E-only: reads back an OTP captured by testUtils({ captureOTP: true }) above. */
export async function getTestOtp(email: string): Promise<string | undefined> {
  const ctx = await auth.$context;
  return ctx.test.getOTP?.(email);
}
