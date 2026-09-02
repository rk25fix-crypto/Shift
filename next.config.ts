import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  // @serwist/next injects a webpack config; this silences Next 16's
  // Turbopack/webpack-config mismatch warning until @serwist/turbopack (or
  // Serwist's configurator mode) has non-experimental Turbopack support.
  turbopack: {},
  // Playwright (e2e/) drives the dev server via 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default withSerwist(nextConfig);
