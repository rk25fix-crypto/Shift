import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("shift type errors", () => {
  test("reusing an existing code shows a friendly message, never the raw database error", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-shifttype-err-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    // Same code again — hits the shift_types_org_code_unique constraint.
    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番2");
    await page.getByRole("button", { name: "追加する" }).click();

    await expect(page.getByText("このコードは既に使われています")).toBeVisible();
    // Regression guard for the bug this fixes: the raw D1 driver error (the
    // failed SQL statement, table/column names, and bound parameter values)
    // must never reach the page.
    await expect(page.getByText(/Failed query/)).toHaveCount(0);
    await expect(page.getByText(/insert into/)).toHaveCount(0);

    // Nothing was actually created a second time.
    await page.goto("/settings/shift-types");
    await expect(page.getByText("早番2")).toHaveCount(0);
  });
});
