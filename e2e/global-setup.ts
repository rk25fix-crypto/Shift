/**
 * `npm run dev` (vinext/Vite RSC dev server) discovers and pre-bundles a
 * route's dependencies lazily, on that route's first request — each new
 * dependency found (e.g. better-auth's, only pulled in by /login and
 * /signup, not by the marketing page) triggers a "[vite] program reload"
 * that briefly drops in-flight connections. On a cold cache, three
 * Playwright workers hitting different routes for the first time at once
 * can land mid-reload and see a browser-level "This page couldn't load",
 * not an assertion failure — the server is healthy, just not warmed up
 * yet. Request every route the suite visits, sequentially, before the
 * parallel workers start, so all reload cycles finish first.
 */
import { request } from "@playwright/test";

const ROUTES = ["/", "/login", "/signup"];
const RETRY_TIMEOUT_MS = 120_000;
const RETRY_INTERVAL_MS = 1000;

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000";
  const context = await request.newContext({ baseURL });
  try {
    for (const route of ROUTES) {
      const deadline = Date.now() + RETRY_TIMEOUT_MS;
      for (;;) {
        try {
          const response = await context.get(route, { timeout: RETRY_INTERVAL_MS * 5 });
          if (response.ok()) break;
        } catch {
          // Server still starting, or mid dependency-optimizer reload — retry.
        }
        if (Date.now() > deadline) {
          throw new Error(`[global-setup] ${route} never returned a healthy response within ${RETRY_TIMEOUT_MS}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
    }
  } finally {
    await context.dispose();
  }
}
