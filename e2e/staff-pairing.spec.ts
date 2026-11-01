import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("staff invite → home-screen login handoff", () => {
  test("a staff member can carry their login into a second, cookie-less browser with a pairing code", async ({
    page,
    browser,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "引き継ぎテスト園",
      email: `e2e-pairing-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("引き継ぎ太郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    // Manager issues the invite link (the URL carries LINE's external-browser hint).
    await page.getByText("引き継ぎ太郎").click();
    await page.getByRole("button", { name: "リンクを発行" }).click();
    const inviteUrl = await page.getByText(/\/invite\//).innerText();
    expect(inviteUrl).toContain("?openExternalBrowser=1");

    // Staff opens it in their own browser (separate cookie jar) and starts.
    const staffContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
    const staffPage = await staffContext.newPage();
    await staffPage.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
    await staffPage.getByRole("button", { name: "はじめる" }).click();
    await staffPage.waitForURL("**/staff-home");

    // Logged in: the staff manifest is linked, and a pairing code can be issued.
    await expect(staffPage.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest-staff.json");
    await staffPage.getByText("ホーム画面アプリでログインする").click();
    await staffPage.getByRole("button", { name: "コードを表示" }).click();
    const codeText = await staffPage.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/).innerText();

    // The "home-screen app": a fresh context with no cookies sees the login prompt.
    const appContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
    const appPage = await appContext.newPage();
    await appPage.goto("/staff-home");
    await expect(appPage.getByText("ログインが必要です")).toBeVisible();

    await appPage.getByLabel("引き継ぎコード").fill("0000-0000"); // 0 is never in the alphabet
    await appPage.getByRole("button", { name: "ログインする" }).click();
    await expect(appPage.getByText("コードが見つからないか、期限切れです")).toBeVisible();

    await appPage.getByLabel("引き継ぎコード").fill(codeText.toLowerCase());
    await appPage.getByRole("button", { name: "ログインする" }).click();
    await expect(appPage.getByText("休み希望", { exact: true })).toBeVisible();

    // One-time: the same code can't log in a third browser.
    const thirdContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
    const thirdPage = await thirdContext.newPage();
    await thirdPage.goto("/staff-home");
    await thirdPage.getByLabel("引き継ぎコード").fill(codeText);
    await thirdPage.getByRole("button", { name: "ログインする" }).click();
    await expect(thirdPage.getByText("コードが見つからないか、期限切れです")).toBeVisible();

    await Promise.all([staffContext.close(), appContext.close(), thirdContext.close()]);
  });
});
