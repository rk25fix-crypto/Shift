import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
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
        await getResend().emails.send({
          from: "Shift <no-reply@example.com>",
          to: email,
          subject: "Shift ログインコード",
          html: `<p>Shift へのログインコードです。</p><p style="font-size:32px;font-weight:700;letter-spacing:0.2em;">${otp}</p><p>アプリに戻り、このコードを入力してください。有効期限は5分です。</p><p style="color:#6b7280;font-size:13px;">心当たりがない場合は、このメールを破棄してください。</p>`,
        });
      },
    }),
    // Must be last — auto-forwards Set-Cookie headers from auth.api.* calls
    // into Next.js's cookie jar when called from Server Actions.
    nextCookies(),
  ],
});
