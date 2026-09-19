import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("audit log", () => {
  test("recorded staff/shift-type/shift-assignment changes show up on the audit log page", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-audit-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("監査テスト太郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    await page.goto("/today");
    await page
      .locator("li", { hasText: "監査テスト太郎" })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: /^早1/ }).click();
    await expect(page.getByText("さんのシフト")).toBeHidden();

    await page.goto("/settings/audit-log");
    await expect(page.getByText("変更履歴")).toBeVisible();
    await expect(page.getByText("スタッフを作成(監査テスト太郎)")).toBeVisible();
    await expect(page.getByText("シフト種別を作成(早1 早番)")).toBeVisible();
    await expect(page.getByText("シフト割当を変更")).toBeVisible();
  });
});
