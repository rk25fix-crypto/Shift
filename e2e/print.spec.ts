import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("print view", () => {
  test("a confirmed shift for today shows up on the print schedule for its month", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-print-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト六郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    // Assigning for *today* keeps this shift inside whatever month
    // PrintLinkForm defaults to (lib/date's monthOf(todayInTimezone())).
    // The two todayInTimezone() calls (one server-side for the assignment,
    // one client-side for the print link) are seconds apart, so this is
    // negligible rather than zero — a real gap only opens right at JST
    // midnight on the last day of a month, unlike the multi-day streak
    // e2e/labor-warnings.spec.ts had to explicitly work around.
    await page.goto("/today");
    await page.getByRole("button", { name: "休み" }).click();
    await page.getByRole("button", { name: /早1 早番/ }).click();
    await expect(page.getByRole("button", { name: "早1" })).toBeVisible();

    await page.goto("/settings/organization");
    await page.getByRole("button", { name: "印刷用シフト表を開く" }).click();
    await page.waitForURL(/\/print\/.+\/\d{4}-\d{2}$/);

    await expect(page.getByRole("heading", { name: /のシフト表/ })).toBeVisible();
    await expect(page.getByText("テスト六郎")).toBeVisible();
    await expect(page.getByRole("cell", { name: "早1", exact: true })).toBeVisible();
  });

  test("rejects opening another organization's print schedule", async ({ page }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園A",
      email: `e2e-print-a-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });
    await page.goto("/settings/organization");
    await page.getByRole("button", { name: "印刷用シフト表を開く" }).click();
    await page.waitForURL(/\/print\/.+\/\d{4}-\d{2}$/);
    const ownUrl = page.url();
    const foreignUrl = ownUrl.replace(/\/print\/[^/]+\//, "/print/not-my-org-id/");

    const response = await page.goto(foreignUrl);
    expect(response?.status()).toBe(404);
  });
});
