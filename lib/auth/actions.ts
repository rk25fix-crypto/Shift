"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth/config";
import { getRawDb } from "@/lib/db/raw";
import { organizations, memberships, subscriptions } from "@/drizzle/schema";

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.body?.message ?? err.message;
  if (err instanceof Error) return err.message;
  return "エラーが発生しました";
}

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

/**
 * Called once, right after a brand-new user's first successful OTP
 * verification during signup. Creates the organization + owner membership +
 * a 14-day trial subscription together so the three rows can never end up
 * out of sync with each other.
 *
 * Uses the raw D1 client (allow-listed in eslint.config.mjs) because this is
 * the one legitimate bootstrap case with no organizationId to scope by yet.
 */
export async function provisionOrganization(
  businessName: string,
): Promise<{ error: string | null }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "ログインが必要です" };

  const db = getRawDb();
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  try {
    const [org] = await db.insert(organizations).values({ name: businessName }).returning();

    await db.batch([
      db.insert(memberships).values({
        organizationId: org.id,
        userId: session.user.id,
        role: "owner",
      }),
      db.insert(subscriptions).values({
        organizationId: org.id,
        plan: "trial",
        status: "trialing",
        trialEndsAt,
      }),
    ]);

    return { error: null };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
