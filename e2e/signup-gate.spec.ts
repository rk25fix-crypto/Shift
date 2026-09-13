import { expect, test } from "@playwright/test";
import { readTestOtp, signUpNewOrg } from "./fixtures";

/**
 * Covers app/(auth)/signup/page.tsx's SignupGate: an already-logged-in
 * visitor must not be able to silently walk through the form again (an old
 * bookmark accidentally creating a second, empty organization), but must
 * still be able to deliberately add a second one — the org switcher exists
 * specifically to support that.
 */
test.describe("signup revisit guard", () => {
  test("an already-logged-in visitor sees a confirmation gate, not the form", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト再訪問保育園",
      email: `e2e-signupgate-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/signup");

    await expect(page.getByText("すでにログイン中です")).toBeVisible();
    await expect(page.getByLabel("事業所名")).not.toBeVisible();

    await page.getByRole("link", { name: "アプリに戻る" }).click();
    await page.waitForURL("/today");
  });

  test("an already-logged-in visitor can deliberately add a second organization, which becomes current", async ({
    page,
  }, testInfo) => {
    const email = `e2e-signupgate2-${testInfo.testId}-${crypto.randomUUID()}@example.com`;
    await signUpNewOrg(page, { businessName: "テスト第一希望保育園", email });

    await page.goto("/signup");

    // InstallPromptBanner (components/ui/InstallPromptBanner.tsx) is `fixed`
    // at the viewport bottom for iOS-flavored user agents (Playwright's
    // iPhone 13 emulation included) and can sit over this page's bottom
    // button — dismiss it first, the same way e2e/fixtures.ts's
    // signUpNewOrg() does.
    const dismissBanner = page.getByRole("button", { name: "閉じる" });
    const bannerAppeared = await dismissBanner
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true, () => false);
    if (bannerAppeared) {
      await dismissBanner.click();
    }

    await page.getByRole("button", { name: "別の事業所を新しく追加する" }).click();

    await page.getByLabel("事業所名").fill("テスト第二希望保育園");
    // Re-using the same email is deliberate: Better Auth's email-otp
    // re-authenticates an existing user on verifyOtp rather than erroring,
    // which is exactly the machinery provisionOrganization() relies on to
    // add a second org to the *same* account instead of creating a new one.
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByRole("button", { name: /無料で始める/ }).click();

    await expect(page.getByLabel("認証コード")).toBeVisible();
    const otp = await readTestOtp(page, email);
    await page.getByLabel("認証コード").fill(otp);
    await page.getByRole("button", { name: "始める" }).click();

    await page.waitForURL("/today");

    // The newly created org must be the one now in view, not a silent
    // fallback to the first — see provisionOrganization()'s
    // setCurrentOrgCookie() call (lib/auth/actions.ts).
    await page.goto("/settings/organization");
    await expect(page.getByText("事業所を切り替え")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "テスト第二希望保育園" }),
    ).toHaveClass(/border-indigo-600/);
    await expect(page.getByRole("button", { name: "テスト第一希望保育園" })).not.toHaveClass(
      /border-indigo-600/,
    );
  });
});
