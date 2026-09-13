import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

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

  test("an already-logged-in visitor can deliberately add a second organization", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト第一希望保育園",
      email: `e2e-signupgate2-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

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

    await expect(page.getByLabel("事業所名")).toBeVisible();

    await page.goto("/settings/organization");
    await expect(page.getByText("事業所を切り替え")).not.toBeVisible();
  });
});
