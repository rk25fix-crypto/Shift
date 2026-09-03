import type { NextConfig } from "next";

// Kept only for the `next dev`/`next build` fallback scripts (vinext
// init preserved these); PWA/service-worker support now lives in
// vite.config.ts (vite-plugin-pwa) since @serwist/next's webpack hook is
// ignored under vinext/Vite — see docs/plan.md "既存実装の移行計画".
const nextConfig: NextConfig = {
  turbopack: {},
  // Playwright (e2e/) drives the dev server via 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
