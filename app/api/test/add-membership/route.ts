import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { addMembershipForUser } from "@/lib/admin/test-add-membership";

/**
 * E2E-only backdoor: adds a second (or third, ...) organization + owner
 * membership for the CURRENTLY LOGGED IN test session, so a multi-org state
 * (components/settings/OrgSwitcher.tsx) can be reached deterministically in
 * a test without a second real signup — that route also works (Better
 * Auth's email-otp re-authenticates an existing user rather than erroring,
 * and lib/auth/actions.ts's provisionOrganization has no guard against
 * being called by an already-logged-in user), but exercises unrelated
 * session-cookie re-authentication machinery a plain "give this test user a
 * second org" fixture has no reason to depend on.
 *
 * Same gating as app/api/test/otp/route.ts: 404 unless
 * ENABLE_TEST_UTILS=true, never set in the deployed Worker.
 */
export async function POST(request: Request) {
  if (process.env.ENABLE_TEST_UTILS !== "true") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "not logged in" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string };
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const organizationId = await addMembershipForUser(session.user.id, body.name);
  return NextResponse.json({ organizationId });
}
