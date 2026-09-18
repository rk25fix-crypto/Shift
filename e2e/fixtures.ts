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
export async function readTestOtp(page: Page, email: string): Promise<string> {
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
 *
 * Walks all 4 wizard steps (components/onboarding/OnboardingWizard.tsx) —
 * industry → email/OTP → confirm shift types → staff names — but adds no
 * staff (leaves the 名前 step empty and taps straight through), matching
 * what every existing caller here expects: a fresh org with no staff yet
 * ("スタッフが登録されていません" in e2e/week.spec.ts, e2e/org-switcher.spec.ts).
 * The industry step DOES create shift types (lib/onboarding/actions.ts's
 * completeOnboarding, via "その他"'s preset) — no test currently asserts a
 * zero-shift-types state after signup, so that's fine as-is.
 */
export async function signUpNewOrg(
  page: Page,
  { businessName, email }: { businessName: string; email: string },
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("事業所名").fill(businessName);
  // "その他" — which industry doesn't matter for tests that don't assert on
  // the generated shift types; this one keeps the preset list short.
  await page.getByRole("button", { name: /その他/ }).click();
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: /無料で始める/ }).click();

  await expect(page.getByLabel("認証コード")).toBeVisible();
  const otp = await readTestOtp(page, email);
  await page.getByLabel("認証コード").fill(otp);
  await page.getByRole("button", { name: "次へ" }).click();

  // 勤務の確認 — accept the generated shift types as-is.
  await page.getByRole("button", { name: "次へ" }).click();

  // 名前だけ入力 — add nobody, finish with 0 staff.
  await page.getByRole("button", { name: "0人でシフトを作る" }).click();

  await page.waitForURL("/today");
  await dismissInstallBanner(page);
}

/**
 * InstallPromptBanner (components/ui/InstallPromptBanner.tsx) is `fixed` at
 * the viewport bottom for any iOS-flavored user agent — which includes
 * Playwright's iPhone 13 emulation — and stays there regardless of
 * scrolling. On a long form, or any bottom-of-screen submit button, it can
 * cover it entirely, so any test that reaches the authenticated app shell
 * (via signUpNewOrg, or its own inline sign-up walk) should dismiss it once
 * here, the same way a real user would tap "閉じる" to get it out of the
 * way. It renders client-side only (the server snapshot is always "hidden",
 * see the component), appearing after hydration — a plain isVisible() check
 * can race that and see nothing, so wait for it instead of just polling
 * once. Not required to appear (a non-iOS project would never show it), so
 * a timeout here is a no-op, not a failure.
 */
export async function dismissInstallBanner(page: Page): Promise<void> {
  const dismissBanner = page.getByRole("button", { name: "閉じる" });
  const bannerAppeared = await dismissBanner
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true, () => false);
  if (bannerAppeared) {
    await dismissBanner.click();
  }
}
