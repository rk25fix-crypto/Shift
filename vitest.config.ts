import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // *.d1.test.ts runs under vitest.d1.config.ts (real Workers runtime via
    // Miniflare) — jsdom can't resolve `cloudflare:workers`/`cloudflare:test`.
    exclude: ["node_modules", ".next", "e2e", "**/*.d1.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
