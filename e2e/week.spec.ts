import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("week view", () => {
  test("shows an empty-state message with no staff, then assigning/clearing a shift persists across a reload", async ({
    page,
  }, testInfo) => {
    // A random suffix, not just testInfo.testId: this test creates lasting
    // state (an org + a staff member), so a Playwright retry reusing the
    // same email would sign back into the first attempt's org instead of a
    // fresh one — see signUpNewOrg's docs on why each call needs a unique
    // email in the first place.
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-week-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/week");
    await expect(page.getByText("スタッフが登録されていません")).toBeVisible();

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト太郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    await page.goto("/week");
    // Scoped to the table body: while the sheet is open, "テスト太郎" also
    // matches the sheet's own "テスト太郎さんのシフト" heading.
    await expect(page.locator("tbody", { hasText: "テスト太郎" })).toBeVisible();
    await expect(page.getByRole("button", { name: "―" })).toHaveCount(7);

    await page.getByRole("button", { name: "―" }).first().click();
    await expect(page.getByText("さんのシフト")).toBeVisible();
    await page.getByRole("button", { name: /^早1/ }).click();
    await expect(page.getByText("さんのシフト")).toBeHidden();

    await page.reload();
    await expect(page.getByRole("button", { name: "早1" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "―" })).toHaveCount(6);

    await page.getByRole("button", { name: "早1" }).click();
    await page.getByRole("button", { name: /^休み\(未割当\)$/ }).click();
    await expect(page.getByText("さんのシフト")).toBeHidden();

    await page.reload();
    await expect(page.getByRole("button", { name: "―" })).toHaveCount(7);
  });

  test("requesting a day off persists across a reload and is cleared by assigning a shift", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-week-timeoff-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト花子");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    await page.goto("/week");
    await page.getByRole("button", { name: "―" }).first().click();
    await page.getByRole("button", { name: "休み希望" }).click();
    await expect(page.getByText("さんのシフト")).toBeHidden();

    await page.reload();
    await expect(page.getByRole("button", { name: "休" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "―" })).toHaveCount(6);

    // Assigning a real shift on a day off should clear the time-off request
    // (they're mutually exclusive — see lib/shifts/assign.ts).
    await page.getByRole("button", { name: "休" }).click();
    await page.getByRole("button", { name: /^早1/ }).click();
    await expect(page.getByText("さんのシフト")).toBeHidden();

    await page.reload();
    await expect(page.getByRole("button", { name: "早1" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "休" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "―" })).toHaveCount(6);
  });
});
