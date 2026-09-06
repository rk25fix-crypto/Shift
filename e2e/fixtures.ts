import { expect, type Page } from "@playwright/test";

/**
 * Reads back a just-sent sign-in OTP via GET /api/test/otp instead of a real
 * inbox (lib/auth/config.ts's testUtils({ captureOTP: true })). Only works
 * when ENABLE_TEST_UTILS=true — CI sets it via `npm run start:e2e`.
 * Locally, `.env.local` can't set this: wrangler.jsonc's `secrets.required`
 * makes `wrangler dev` (and `vinext dev`, which uses the same machinery)
 * only forward vars/secrets already listed in `vars` or `secrets.required`,
 * so run `npm run e2e:server` in a separate terminal first (see README.md).
 */
async function readTestOtp(page: Page, email: string): Promise<string> {
  const response = await page.request.get(
    `/api/test/otp?email=${encodeURIComponent(email)}`,
  );
  expect(
    response.ok(),
    "GET /api/test/otp failed — run `npm run e2e:server` first (see README.md's E2E section) instead of a plain `npm run dev`.",
  ).toBeTruthy();
  const body = (await response.json()) as { otp: string };
  return body.otp;
}

/**
 * Signs up a brand-new organization end-to-end through the real UI (not a
 * shortcut through server actions), landing on /today. Each call needs a
 * unique email — Better Auth's `user.email` column is unique — so callers
 * should derive one per test (e.g. from `test.info().testId`).
 */
export async function signUpNewOrg(
  page: Page,
  { businessName, email }: { businessName: string; email: string },
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("事業所名").fill(businessName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: /無料で始める/ }).click();

  await expect(page.getByLabel("認証コード")).toBeVisible();
  const otp = await readTestOtp(page, email);
  await page.getByLabel("認証コード").fill(otp);
  await page.getByRole("button", { name: "始める" }).click();

  await page.waitForURL("/today");

  // InstallPromptBanner (components/ui/InstallPromptBanner.tsx) is `fixed`
  // at the viewport bottom for any iOS-flavored user agent — which includes
  // Playwright's iPhone 13 emulation — and stays there regardless of
  // scrolling. On a long form (e.g. /settings/shift-types/new) it can cover
  // the submit button entirely, so every test that fills a form dismisses
  // it here once, the same way a real user would tap "閉じる" to get it out
  // of the way. It renders client-side only (the server snapshot is always
  // "hidden", see the component), appearing after hydration — a plain
  // isVisible() check can race that and see nothing, so wait for it instead
  // of just polling once. Not required to appear (a non-iOS project would
  // never show it), so a timeout here is a no-op, not a failure.
  const dismissBanner = page.getByRole("button", { name: "閉じる" });
  const bannerAppeared = await dismissBanner
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true, () => false);
  if (bannerAppeared) {
    await dismissBanner.click();
  }
}
