import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("payroll estimate", () => {
  test("assigning a shift and setting an hourly wage shows the estimated pay on the staff detail page", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-payroll-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト四郎");
    await page.getByLabel("時給(円、任意)").fill("1000");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    // Default shift-type times (09:00〜18:00, 60min break) give an easy
    // round-number check: 9h gross - 1h break = 8h worked, x ¥1,000 = ¥8,000.
    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    // Assigning for *today* (Today view's default date) keeps this shift
    // inside whatever "this calendar month" the staff-detail page queries,
    // with no month-boundary timing risk to guard against (unlike a
    // multi-day streak — see e2e/labor-warnings.spec.ts).
    await page.goto("/today");
    await page.getByRole("button", { name: "休み" }).click();
    await page.getByRole("button", { name: /早1 早番/ }).click();
    await expect(page.getByRole("button", { name: "早1" })).toBeVisible();

    await page.goto("/staff");
    await page.getByRole("link", { name: "テスト四郎" }).click();
    await expect(page.getByText("今月の給与概算")).toBeVisible();
    // lib/payroll.ts assumes Sunday is the 法定休日 (+35%) — whatever day
    // "today" actually is when this test runs changes the expected total,
    // so this computes the same thing production does instead of hardcoding
    // a value that would only be right 6 days out of 7.
    const isSunday = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }) === "Sun";
    if (isSunday) {
      await expect(page.getByText("¥10,800")).toBeVisible();
      await expect(page.getByText("8時間 × 時給¥1,000(内 休日8h 割増を含む)")).toBeVisible();
    } else {
      await expect(page.getByText("¥8,000")).toBeVisible();
      await expect(page.getByText("8時間 × 時給¥1,000")).toBeVisible();
    }
  });

  test("no payroll section appears until an hourly wage is set", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-payroll-nowage-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト五郎");
    // Leave 時給 blank — no compensation row is created.
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    await page.getByRole("link", { name: "テスト五郎" }).click();
    await expect(page.getByText("今月の給与概算")).not.toBeVisible();
  });
});
