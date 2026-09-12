import { expect, type Page, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

/**
 * Adds a second organization for the already-logged-in test user via the
 * E2E-only backdoor (app/api/test/add-membership/route.ts) rather than a
 * second real signup — see that route's docstring for why.
 */
async function addSecondOrg(page: Page, name: string): Promise<void> {
  // Not page.request.post(): Playwright's APIRequestContext does not send
  // the browser context's cookies to this dev server (observed directly —
  // the route received no `cookie` header at all), so the request has to
  // run as a real fetch() from inside the page itself to carry the Better
  // Auth session cookie the same way ordinary navigation does.
  const result = await page.evaluate(async (orgName) => {
    const response = await fetch("/api/test/add-membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName }),
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }, name);

  expect(
    result.ok,
    `POST /api/test/add-membership failed (${result.status}: ${result.body}) — run \`npm run e2e:server\` first (see README.md's E2E section).`,
  ).toBeTruthy();
}

test.describe("org switcher", () => {
  test("a user who belongs to two organizations can switch between them", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト第一保育園",
      email: `e2e-orgswitch-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    // No second organization yet — the switcher must not appear for a
    // single-org user.
    await page.goto("/settings/organization");
    await expect(page.getByText("事業所を切り替え")).not.toBeVisible();

    await addSecondOrg(page, "テスト第二保育園");

    await page.goto("/settings/organization");
    await expect(page.getByText("事業所を切り替え")).toBeVisible();
    await expect(page.getByRole("button", { name: "テスト第一保育園" })).toBeVisible();
    await expect(page.getByRole("button", { name: "テスト第二保育園" })).toBeVisible();

    // Still viewing the first org (no switch happened yet) — add a staff
    // member here so switching has something visibly different to show.
    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("第一事業所スタッフ");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");
    await expect(page.getByText("第一事業所スタッフ")).toBeVisible();

    await page.goto("/settings/organization");
    await page.getByRole("button", { name: "テスト第二保育園" }).click();
    await page.waitForURL("/today");

    // Now viewing the second org — it must not show the first org's staff.
    await page.goto("/staff");
    await expect(page.getByText("スタッフが登録されていません")).toBeVisible();
    await expect(page.getByText("第一事業所スタッフ")).not.toBeVisible();

    // Switching back shows the first org's data again.
    await page.goto("/settings/organization");
    await page.getByRole("button", { name: "テスト第一保育園" }).click();
    await page.waitForURL("/today");
    await page.goto("/staff");
    await expect(page.getByText("第一事業所スタッフ")).toBeVisible();
  });
});
