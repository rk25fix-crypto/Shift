import { NextResponse } from "next/server";
import { getTestOtp } from "@/lib/auth/config";

/**
 * E2E-only backdoor for reading a just-generated sign-in OTP without a real
 * inbox. Returns 404 (indistinguishable from a route that doesn't exist)
 * unless ENABLE_TEST_UTILS=true — never set in the deployed Worker (it's
 * absent from wrangler.jsonc's vars and from the dashboard secrets). Set via
 * `wrangler dev --var ENABLE_TEST_UTILS:true` (`npm run start:e2e` /
 * `npm run e2e:server`) — see e2e/fixtures.ts for why a `.dev.vars` /
 * .env.local entry doesn't work here.
 */
export async function GET(request: Request) {
  if (process.env.ENABLE_TEST_UTILS !== "true") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const otp = await getTestOtp(email);
  if (!otp) {
    return NextResponse.json({ error: "no OTP captured for this email" }, { status: 404 });
  }

  return NextResponse.json({ otp });
}
