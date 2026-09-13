import { getCurrentMembership } from "@/lib/org/current";
import { SignupForm } from "@/components/auth/SignupForm";
import { SignupGate } from "@/components/auth/SignupGate";

/**
 * A logged-in visitor who lands here (an old bookmark, a stray link) sees a
 * confirmation gate instead of the form — Better Auth's email-otp
 * re-authenticates an existing user rather than erroring on verifyOtp, so
 * without this an accidental revisit could silently walk through the form
 * again and leave provisionOrganization() (lib/auth/actions.ts) creating a
 * second, empty organization for them. A user who *does* want to add another
 * business (the org switcher exists to support exactly that) can still get
 * to the form via SignupGate's explicit "別の事業所を新しく追加する" tap.
 */
export default async function SignupPage() {
  const membership = await getCurrentMembership();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <h1 className="text-2xl font-bold">無料で試す</h1>
      {membership ? <SignupGate /> : <SignupForm />}
    </main>
  );
}
