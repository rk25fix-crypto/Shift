"use server";

import { auth } from "@/lib/auth/config";
import { errorMessage } from "@/lib/auth/provision";

/**
 * Sends a 6-digit OTP code to `email`. This is the primary login path (see
 * docs/plan.md "認証方式") — a tapped magic link opens Safari instead of
 * the installed PWA, so login must be completable by typing a code without
 * ever leaving the app.
 */
export async function requestOtp(email: string): Promise<{ error: string | null }> {
  try {
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    return { error: null };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function verifyOtp(email: string, otp: string): Promise<{ error: string | null }> {
  try {
    // Also handles first-time sign-up (Better Auth creates the user record
    // on first successful verification — see lib/auth/config.ts). The
    // `nextCookies()` plugin forwards the resulting session cookie
    // automatically since this runs inside a Server Action.
    await auth.api.signInEmailOTP({ body: { email, otp } });
    return { error: null };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

