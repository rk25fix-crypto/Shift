import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("auth", () => {
  test("signing up with a business name and OTP lands on the today view", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The bottom nav's own tab confirms this is the real authenticated app
    // shell, not just a URL match.
    await expect(page.getByRole("link", { name: "今日" })).toBeVisible();
  });
});
