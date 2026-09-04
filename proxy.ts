import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/pricing", "/login", "/signup"];

/**
 * Optimistic, cookie-presence-only redirect — Better Auth's own docs call
 * this pattern "not secure" on its own, since it never touches the
 * database. Real enforcement happens per-page via
 * lib/org/current.ts's requireCurrentMembership() (which calls
 * auth.api.getSession()); this just avoids rendering protected UI for an
 * obviously-signed-out visitor before that check runs.
 */
export async function proxy(request: NextRequest) {
  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname === path);
  if (isPublicPath) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
