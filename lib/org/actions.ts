"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { getRawDb } from "@/lib/db/raw";
import { memberships } from "@/drizzle/schema";
import { CURRENT_ORG_COOKIE } from "@/lib/org/current";

/**
 * Sets which of the logged-in user's organizations is "current" (see
 * lib/org/current.ts's pickCurrentMembership) — the server side of
 * components/settings/OrgSwitcher.tsx. Every page re-derives organizationId
 * from this cookie via getCurrentMembership(), so this alone is enough to
 * switch the whole app's view of "which org am I in" without any other
 * per-page plumbing.
 */
export async function switchOrganization(organizationId: string): Promise<{ error: string | null }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "ログインが必要です" };

  // organizationId comes from the client — confirming it's actually one of
  // this user's own memberships before trusting it is what keeps this from
  // becoming an open door into another user's org (D1 has no RLS to catch
  // it otherwise; see lib/db/scopedClient.ts).
  const db = getRawDb();
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, session.user.id), eq(memberships.organizationId, organizationId)));
  if (!row) return { error: "この事業所には所属していません" };

  (await cookies()).set(CURRENT_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { error: null };
}
