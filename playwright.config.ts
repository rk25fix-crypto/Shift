import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      // Regression guard for the crux mobile-UX risk (docs/plan.md,
      // "iPhone向けUIの核心方針"): the shift grid must never silently
      // regress into a wide desktop table. Uses the iPhone 13 viewport /
      // touch metrics under Chromium rather than the device preset's
      // default WebKit engine, since only Chromium ships in this repo's
      // sandboxes/CI. True iOS Safari quirks (safe-area, standalone mode,
      // Cookie partitioning) are out of scope here — covered by the manual
      // UAT checklist instead.
      name: "iPhone 13 (mobile viewport, Chromium)",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : undefined,
      },
    },
  ],
  webServer: {
    // In CI, serve the production build (`npm run build` in the workflow,
    // then `npm run start:e2e` = `wrangler dev` against the prebuilt worker)
    // instead of the live `vinext dev` server. `vinext dev`'s Vite-based
    // dev server hung indefinitely on a fresh GitHub Actions runner with
    // zero output past its startup banner (reproduced across two full CI
    // runs, up to a 300s timeout) — root cause not pinned down, but
    // `wrangler dev` against a prebuilt worker starts in well under a
    // second even with every local cache (.wrangler, ~/.config/.wrangler,
    // dist/) cleared, and sidesteps whatever in `vinext dev`'s startup
    // path was hanging. Locally, `npm run dev` keeps live reload.
    //
    // start:e2e passes --var ENABLE_TEST_UTILS:true so tests can read a
    // just-sent sign-in OTP from GET /api/test/otp instead of a real inbox
    // (lib/auth/config.ts). It has to be --var, not a `.dev.vars` file:
    // wrangler.jsonc declares `secrets.required`, which makes wrangler dev
    // only forward vars/secrets that are either in `vars` or in
    // `secrets.required` — ENABLE_TEST_UTILS is neither, so `.dev.vars` or
    // .env.local entries for it are silently dropped (confirmed locally: it
    // never reaches process.env that way). --var bypasses that allow-list.
    // For local (non-CI) runs against `vinext dev`, the same allow-list
    // applies (vinext dev goes through the same wrangler dev machinery), so
    // there's no `.env.local` equivalent — use `npm run e2e:server` in one
    // terminal (build + migrate + start:e2e) and `npm run e2e` in another;
    // reuseExistingServer below picks it up.
    //
    // db:migrate:local must run before start:e2e: `wrangler dev --config
    // dist/server/wrangler.json` persists its local D1 replica under
    // dist/server/.wrangler/state by default — a different directory from
    // the repo-root .wrangler/state that `wrangler d1 migrations apply
    // --local` (no --config) would otherwise use — so every table lookup
    // failed with a fresh checkout until both were pinned to the same
    // --persist-to path (see package.json).
    command: process.env.CI ? "npm run e2e:server" : "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
