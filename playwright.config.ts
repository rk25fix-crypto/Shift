import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
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
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
