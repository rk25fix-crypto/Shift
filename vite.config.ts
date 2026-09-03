import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";
import path from "node:path";

/**
 * Wraps a plugin's hooks so they no-op outside the "client" Vite
 * environment. See the VitePWA(...) comment below for why this is needed.
 */
function restrictToClientEnvironment(plugin: Plugin): Plugin {
  const { generateBundle, closeBundle } = plugin;
  return {
    ...plugin,
    generateBundle:
      typeof generateBundle === "function"
        ? function (this, ...args) {
            if (this.environment?.name !== "client") return;
            return generateBundle.apply(this, args);
          }
        : generateBundle,
    closeBundle:
      typeof closeBundle === "function"
        ? function (this, ...args) {
            if (this.environment?.name !== "client") return;
            return closeBundle.apply(this, args);
          }
        : closeBundle && typeof closeBundle === "object"
          ? {
              ...closeBundle,
              handler: function (this, ...args: Parameters<typeof closeBundle.handler>) {
                if (this.environment?.name !== "client") return;
                return closeBundle.handler.apply(this, args);
              },
            }
          : closeBundle,
  };
}

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
    // Replaces @serwist/next (Phase 0), which hooked next.config.ts's
    // webpack config — vinext ignores that option entirely, so PWA/service
    // worker support has to be a Vite plugin instead. `manifest: false`
    // because public/manifest.json + the <link> in app/layout.tsx already
    // work and don't depend on the build tool; this plugin only generates
    // and registers the service worker (see components/pwa/RegisterServiceWorker.tsx).
    //
    // vinext's `vite build` uses Vite's multi-environment Builder API (one
    // build per environment: client/rsc/ssr/server, see cli.js's
    // `createBuilder(...).buildApp()`). vite-plugin-pwa's closeBundle hook
    // only guards against the legacy `config.build.ssr` flag, which stays
    // false for every one of vinext's named environments — so it re-runs
    // (and tries to glob `dist/client`) for non-client environments too,
    // before the client environment has even written its assets to disk.
    // Restrict it to the "client" environment the same way vinext's own
    // plugin does internally (`this.environment?.name === "client"`).
    ...VitePWA({
      manifest: false,
      injectRegister: false,
      registerType: "autoUpdate",
      // Also drives swDest — without it the plugin falls back to the
      // shared/root resolved config's build.outDir ("dist"), which would
      // write sw.js next to dist/client instead of inside it, where
      // wrangler.jsonc's assets.directory won't serve it from.
      outDir: "dist/client",
      workbox: {
        // SSR/RSC pages are session-specific — never let the SW serve a
        // cached navigation instead of hitting the server (docs/plan.md,
        // "PWA固有の対応": network-first for data).
        navigateFallback: null,
        // vinext's client build output — see wrangler.jsonc's assets.directory.
        globDirectory: "dist/client",
        globPatterns: ["**/*.{js,css,ico,png,svg,webp}"],
      },
    }).map((plugin) =>
      plugin.name === "vite-plugin-pwa:build"
        ? restrictToClientEnvironment(plugin)
        : plugin,
    ),
  ],
  resolve: {
    alias: {
      "sharp": path.resolve(__dirname, "empty-stub.js"),
    },
  },
});
