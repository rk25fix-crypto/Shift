import { expect, test } from "@playwright/test";

test.describe("mobile smoke", () => {
  test("marketing landing page renders on a 390px viewport", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /シフト管理を、iPhoneひとつで/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "無料で試す" })).toBeVisible();

    // Guards the crux UX risk from docs/plan.md: nothing on this page
    // should force horizontal scroll on a phone-width viewport.
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test("login page offers an email-first OTP form, not a password field", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("メールアドレス")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("signup page collects business name before sending a code", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByLabel("事業所名")).toBeVisible();
    await expect(page.getByRole("button", { name: /無料で始める/ })).toBeVisible();
  });
});
