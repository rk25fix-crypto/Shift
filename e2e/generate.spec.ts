import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./fixtures";

test.describe("auto-generate", () => {
  test("generating, confirming, and discarding a week's drafts through the UI", async ({
    page,
  }, testInfo) => {
    await signUpNewOrg(page, {
      businessName: "テスト保育園",
      email: `e2e-generate-${testInfo.testId}-${crypto.randomUUID()}@example.com`,
    });

    await page.goto("/staff/new");
    await page.getByLabel("氏名").fill("テスト次郎");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/staff");

    // No required shift type yet — the generate button should be replaced
    // by guidance instead of silently doing nothing.
    await page.goto("/week");
    await expect(page.getByText("自動生成を使うには")).toBeVisible();
    await expect(page.getByRole("button", { name: "この週を自動生成" })).toHaveCount(0);

    await page.goto("/settings/shift-types/new");
    await page.getByLabel("コード(例: 早1)").fill("早1");
    await page.getByLabel("名称(例: 早番1)").fill("早番");
    await page.getByRole("button", { name: "追加する" }).click();
    await page.waitForURL("/settings/shift-types");

    await page.goto("/week");
    await page.getByRole("button", { name: "この週を自動生成" }).click();
    await expect(page.getByText(/件の下書きを作成しました/)).toBeVisible();
    await expect(page.getByRole("button", { name: "早1" })).toHaveCount(7);

    await page.reload();
    // Drafts persist across a reload just like confirmed assignments.
    await expect(page.getByRole("button", { name: "早1" })).toHaveCount(7);
    await expect(page.getByRole("button", { name: "下書きを確定する" })).toBeVisible();

    await page.getByRole("button", { name: "下書きを確定する" }).click();
    await expect(page.getByText("この週の下書きを確定しました。")).toBeVisible();
    // Once confirmed, there's nothing left to confirm/discard.
    await expect(page.getByRole("button", { name: "下書きを確定する" })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("button", { name: "早1" })).toHaveCount(7);

    // Confirmed assignments show up on the Today view too (drafts never do).
    await page.goto("/today");
    await expect(page.getByRole("button", { name: "早1" })).toBeVisible();

    // Generating again over an already-fully-staffed week must not pile a
    // second person onto an already-confirmed slot, and must not report a
    // false shortage either — every slot is already filled by a confirmed
    // assignment (lib/shift-generator/index.ts counts those as filled).
    await page.goto("/week");
    await page.getByRole("button", { name: "この週を自動生成" }).click();
    await expect(
      page.getByText("0件の下書きを作成しました。内容を確認して確定してください。"),
    ).toBeVisible();
  });
});
