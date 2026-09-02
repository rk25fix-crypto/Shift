import Stripe from "stripe";

let client: Stripe | undefined;

/**
 * Lazily constructed so importing this module doesn't require
 * STRIPE_SECRET_KEY at build time (Next.js evaluates route modules during
 * `next build`'s page-data collection, before any request exists).
 */
export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return client;
}
