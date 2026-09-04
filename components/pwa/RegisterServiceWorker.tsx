/// <reference types="vite-plugin-pwa/client" />
"use client";

import { useEffect } from "react";

/**
 * vite-plugin-pwa's HTML injection targets a plain index.html, which this
 * RSC app doesn't have — so registration happens explicitly here instead of
 * via `injectRegister` (see vite.config.ts).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    let cancelled = false;

    import("virtual:pwa-register").then(({ registerSW }) => {
      if (!cancelled) registerSW({ immediate: true });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
