import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getRawDb } from "@/lib/db/raw";
import { staffSessions } from "@/drizzle/schema";

/**
 * Cookie for the staff self-service session (design_handoff_shift_bright_flow
 * /README.md 1c/2i) — deliberately separate from Better Auth's own session
 * cookie. This is a link-only credential (no password/OTP): anyone holding a
 * live token in this cookie can act as that one staff member, scoped to
 * exactly the staffId/organizationId the token resolves to, and nothing
 * else — it is never checked against `memberships`/role, so it can't be used
 * to reach any admin-only action.
 */
export const STAFF_SESSION_COOKIE = "shift_staff_session";

export interface CurrentStaffSession {
  organizationId: string;
  staffId: string;
}

export async function setStaffSessionCookie(token: string): Promise<void> {
  (await cookies()).set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Resolves the staff self-service session cookie, if any, to the
 * organizationId/staffId it grants access to. Expired sessions resolve to
 * null rather than being deleted here — session rows are cheap and a lazy
 * sweep (lib/admin) can clean them up later; this path only ever needs to
 * decide "is this still good," not "shall I be a garbage collector."
 */
export async function getCurrentStaffSession(): Promise<CurrentStaffSession | null> {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getRawDb();
  const [row] = await db
    .select({
      organizationId: staffSessions.organizationId,
      staffId: staffSessions.staffId,
      expiresAt: staffSessions.expiresAt,
    })
    .from(staffSessions)
    .where(eq(staffSessions.token, token));

  if (!row || row.expiresAt.getTime() < Date.now()) return null;

  return { organizationId: row.organizationId, staffId: row.staffId };
}

/** Same as getCurrentStaffSession(), but throws for pages/actions that require a claimed invite to render at all. */
export async function requireCurrentStaffSession(): Promise<CurrentStaffSession> {
  const session = await getCurrentStaffSession();
  if (!session) throw new Error("この操作には招待リンクからのログインが必要です。");
  return session;
}
