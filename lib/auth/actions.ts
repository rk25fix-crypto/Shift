"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sends a 6-digit OTP code to `email`. This is the primary login path (see
 * docs/plan.md "認証方式") — a tapped magic link opens Safari instead of
 * the installed PWA, so login must be completable by typing a code without
 * ever leaving the app.
 */
export async function requestOtp(email: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return { error: error?.message ?? null };
}

export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  return { error: error?.message ?? null };
}

/**
 * Called once, right after a brand-new user's first successful OTP
 * verification during signup. Creates the organization + owner membership +
 * a 14-day trial subscription in one call via a Postgres function so the
 * three rows can never be created out of sync with each other.
 */
export async function provisionOrganization(
  businessName: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_for_current_user", {
    p_business_name: businessName,
  });
  return { error: error?.message ?? null };
}
