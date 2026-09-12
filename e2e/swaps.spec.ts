import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("swap requests", () => {
  test("recording a swap request and approving it moves the shift to the other staff member", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-swaps-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト太郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト次郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    // Give テスト太郎 today's 早1 shift through the Today view, the same way
    // a manager normally would — this is the shift the swap will move.
    await page.goto("/today");
    await page
      .locator("li", { hasText: "テスト太郎" })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: /^早1/ }).click();
    await expect(page.getByText("さんのシフト")).toBeHidden();

    // The swap form defaults its date to today (lib/date's todayInTimezone,
    // same helper used here and by the form) — listStaff orders
    // alphabetically, and テスト太郎 sorts before テスト次郎, matching the
    // form's from/to defaults, so neither staff select needs changing.
    await page.goto("/swaps");
    await page
      .getByLabel("現在のシフト(手放す側、無ければ「なし」)")
      .first()
      .selectOption({ label: "早1 早番" });
    await page.getByRole("button", { name: "この内容で交代申請を作る" }).click();

    await expect(page.getByText("テスト太郎(早1 早番) ⇄ テスト次郎(休み)")).toBeVisible();
    await expect(page.getByText("未処理")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "承認する" }).click();
    await expect(page.getByText("承認済み")).toBeVisible();

    // The shift actually moved: テスト次郎 now has it, テスト太郎 no longer does.
    await page.goto("/today");
    await expect(
      page.locator("li", { hasText: "テスト次郎" }).getByRole("button", { name: "早1" }),
    ).toBeVisible();
    await expect(
      page.locator("li", { hasText: "テスト太郎" }).getByRole("button", { name: "休み" }),
    ).toBeVisible();
  });

  test("rejecting a swap request leaves the schedule untouched", async ({ page }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-swaps-reject-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト三郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト四郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    await page.goto("/today");
    await page
      .locator("li", { hasText: "テスト三郎" })
      .getByRole("button")
      .click();
    await page.getByRole("button", { name: /^早1/ }).click();
    await expect(page.getByText("さんのシフト")).toBeHidden();

    await page.goto("/swaps");
    await page
      .getByLabel("現在のシフト(手放す側、無ければ「なし」)")
      .first()
      .selectOption({ label: "早1 早番" });
    await page.getByRole("button", { name: "この内容で交代申請を作る" }).click();
    await expect(page.getByText("未処理")).toBeVisible();

    await page.getByRole("button", { name: "却下する" }).click();
    await expect(page.getByText("却下済み")).toBeVisible();

    await page.goto("/today");
    await expect(
      page.locator("li", { hasText: "テスト三郎" }).getByRole("button", { name: "早1" }),
    ).toBeVisible();
    await expect(
      page.locator("li", { hasText: "テスト四郎" }).getByRole("button", { name: "休み" }),
    ).toBeVisible();
  });
});
