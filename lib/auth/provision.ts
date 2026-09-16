import { APIError } from "better-auth/api";
import { getRawDb } from "@/lib/db/raw";
import { toUserFacingError } from "@/lib/db/errors";
import { setCurrentOrgCookie } from "@/lib/org/current";
import { organizations, memberships, subscriptions } from "@/drizzle/schema";

/**
 * Better Auth's APIError.body.message is deliberately user-facing text (e.g.
 * "invalid OTP") and safe to show as-is. Anything else — a raw D1/Drizzle
 * error from provisionOrganizationCore's inserts, an unexpected failure
 * inside Better Auth's own DB adapter or email hook (lib/auth/config.ts) —
 * is not, for the same reason as lib/db/errors.ts: it can contain
 * table/column names and bound values.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.body?.message ?? err.message;
  return toUserFacingError(err, "エラーが発生しました");
}

/**
 * Creates the organization + owner membership + a 14-day trial subscription
 * together so the three rows can never end up out of sync with each other.
 * Shared by lib/auth/actions.ts's provisionOrganization() and
 * lib/onboarding/actions.ts's completeOnboarding() — the onboarding wizard
 * needs the new organizationId back so it can immediately create shift
 * types/staff/a draft for it in the same request, which a bare {error}
 * return can't support.
 *
 * Deliberately NOT in lib/auth/actions.ts (a "use server" file): every
 * exported async function in a "use server" module is reachable directly as
 * a Server Action endpoint, and this one takes `userId` as a plain
 * parameter with no session check of its own — callers are responsible for
 * resolving `userId` from a real session first. Living in a plain module
 * (like every other *Core function — lib/shift-types/write.ts,
 * lib/staff/write.ts) makes that impossible to call from the client.
 *
 * Uses the raw D1 client (allow-listed in eslint.config.mjs) because this is
 * the one legitimate bootstrap case with no organizationId to scope by yet.
 *
 * Intentionally has no "already has a membership" guard: a user can belong
 * to more than one organization (see the org switcher,
 * components/settings/OrgSwitcher.tsx), and this is the only path that
 * creates one. What must not happen is an *accidental* second call — that's
 * handled up in app/(auth)/signup/page.tsx (SignupGate), which keeps an
 * already-logged-in visitor from reaching this form without an explicit tap.
 *
 * Sets CURRENT_ORG_COOKIE to the new org once it's created. Without this, a
 * user adding a second organization would land back on the *first* one after
 * signup — getCurrentMembership() falls back to the earliest membership when
 * there's no cookie — making it look like nothing happened and inviting a
 * retry that creates yet another duplicate.
 */
export async function provisionOrganizationCore(
  businessName: string,
  userId: string,
  businessType: string | null = null,
): Promise<{ organizationId: string; error: null } | { organizationId: null; error: string }> {
  const db = getRawDb();

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  try {
    const [org] = await db
      .insert(organizations)
      .values({ name: businessName, businessType })
      .returning();

    await db.batch([
      db.insert(memberships).values({
        organizationId: org.id,
        userId,
        role: "owner",
      }),
      db.insert(subscriptions).values({
        organizationId: org.id,
        plan: "trial",
        status: "trialing",
        trialEndsAt,
      }),
    ]);

    await setCurrentOrgCookie(org.id);

    return { organizationId: org.id, error: null };
  } catch (err) {
    return { organizationId: null, error: errorMessage(err) };
  }
}
