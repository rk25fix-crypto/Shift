import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getRawDb } from "@/lib/db/raw";
import { subscriptions } from "@/drizzle/schema";

/**
 * Handles Stripe subscription lifecycle events. Runs on the raw D1 client
 * (allow-listed in eslint.config.mjs) because there is no logged-in user on
 * a webhook request — Stripe's signature check authenticates this request
 * instead of a session, and this is the one write path with no
 * organizationId to scope by (it derives the org from the Stripe payload).
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    // constructEvent's synchronous signature check depends on Node's crypto
    // module and does not run on Cloudflare Workers — constructEventAsync +
    // the SubtleCrypto-based provider is the Workers-compatible path.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  const db = getRawDb();

  // Idempotency: Stripe can resend the same event, so a second delivery must
  // be a no-op rather than double-applying (e.g. extending a trial twice).
  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeEventId, event.id))
    .limit(1);

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.client_reference_id;
      if (organizationId) {
        await db
          .update(subscriptions)
          .set({
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            status: "active",
            stripeEventId: event.id,
          })
          .where(eq(subscriptions.organizationId, organizationId));
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.parent?.subscription_details?.subscription as
        | string
        | undefined;
      if (subscriptionId) {
        await db
          .update(subscriptions)
          .set({ status: "active", stripeEventId: event.id })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.parent?.subscription_details?.subscription as
        | string
        | undefined;
      if (subscriptionId) {
        await db
          .update(subscriptions)
          .set({ status: "past_due", stripeEventId: event.id })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await db
        .update(subscriptions)
        .set({ status: "canceled", stripeEventId: event.id })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
