import { expect, test } from "@playwright/test";
import { mondayOf, monthOf, todayInTimezone } from "@/lib/date";
import { signUpNewOrg } from "./fixtures";

// The staff-detail page's labor warnings only query the *current calendar
// month* (plus a short lookback). Using "today's" week would make this test
// flaky right at a month boundary: if the generated week straddles two
// months, too few of the streak's days fall inside the queried month to
// trigger detection. Pin generation to the Monday of the week containing
// the 8th of the current month instead — that week always runs from the
// 2nd-8th at the earliest to the 8th-14th at the latest, so it's guaranteed
// to sit entirely inside the current month regardless of which weekday the
// 8th falls on.
function monthSafeMonday(): string {
  const eighthOfThisMonth = `${monthOf(todayInTimezone())}-08`;
  return mondayOf(eighthOfThisMonth);
}

test.describe("labor warnings", () => {
  test("a 7-day streak from auto-generate shows a warning on the week view and staff detail page", async ({
    page,
  }, testInfo) => {
    const weekStart = monthSafeMonday();

    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-warnings-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト三郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    // With only one staff member eligible every day, generating and
    // confirming a full week assigns them all 7 days — a streak longer
    // than the default 6-day limit (lib/labor-rules.ts).
    await page.goto(`/week?start=${weekStart}`);
    await page.getByRole("button", { name: "この週を自動生成" }).click();
    await expect(page.getByText(/件の下書きを作成しました/)).toBeVisible();
    await page.getByRole("button", { name: "下書きを確定する" }).click();
    await expect(page.getByText("この週の下書きを確定しました。")).toBeVisible();

    await page.reload();
    await expect(page.locator('[aria-label="勤務ルール警告あり"]')).toBeVisible();

    await page.goto("/staff");
    await page.getByRole("link", { name: "テスト三郎" }).click();
    await expect(page.getByText(/連勤/)).toBeVisible();
    await expect(page.getByText("勤務ルール警告")).toBeVisible();
  });
});
