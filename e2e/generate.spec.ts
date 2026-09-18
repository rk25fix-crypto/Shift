import { expect, test } from "@playwright/test";
import { dismissInstallBanner, readTestOtp } from "./fixtures";

test.describe("auto-generate", () => {
  test("generating, confirming, and discarding a week's drafts through the UI", async ({
    page,
  }, testInfo) => {
    // Not e2e/fixtures.ts's signUpNewOrg here: it accepts the wizard's
    // generated shift types as-is (components/onboarding/OnboardingWizard.tsx's
    // 勤務の確認 step), but this test specifically needs a shift-types-free
    // org to exercise the "no required shift type yet" guidance below — so
    // it walks the wizard itself and toggles every preset off first.
    const email = `e2e-generate-${testInfo.testId}-${crypto.randomUUID()}@example.com`;
    await page.goto("/signup");
    await page.getByLabel("事業所名").fill("テスト保育園");
    await page.getByRole("button", { name: /その他/ }).click();
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByRole("button", { name: /無料で始める/ }).click();
    // Wait for the OTP screen (i.e. requestOtp's server action actually
    // finished) before reading it back — otherwise this can race the send.
    await expect(page.getByLabel("認証コード")).toBeVisible();
    const otp = await readTestOtp(page, email);
    await page.getByLabel("認証コード").fill(otp);
    await page.getByRole("button", { name: "次へ" }).click();

    // 勤務の確認 — toggle every preset off ("使う" -> "使わない") so onboarding
    // creates zero shift types. verifyOtp is an async server action, so the
    // step transition lands a moment after the click resolves — wait for
    // the step's own heading before querying its buttons.
    await expect(page.getByRole("heading", { name: "勤務の確認" })).toBeVisible();
    // Not .all() + a loop over the collected list: each click changes that
    // button's own accessible name (使う -> 使わない), so the /使う$/ locator
    // re-matches a shrinking set on every re-evaluation — .all()'s indices
    // (nth=0, nth=1, ...) drift out from under a list that's shifting as you
    // click it. Always re-querying and clicking .first() sidesteps that.
    const useButton = page.getByRole("button", { name: /使う$/ });
    while (await useButton.count() > 0) {
      await useButton.first().click();
    }
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("button", { name: "0人でシフトを作る" }).click();
    await page.waitForURL("/today");
    await dismissInstallBanner(page);

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
