import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Handles Stripe subscription lifecycle events. Runs on the service-role
 * client (allow-listed in eslint.config.mjs) because there is no logged-in
 * user on a webhook request — Stripe's signature check is what authenticates
 * this request instead of a Supabase session.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency: Stripe can resend the same event, so a second delivery must
  // be a no-op rather than double-applying (e.g. extending a trial twice).
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.client_reference_id;
      if (organizationId) {
        await supabase
          .from("subscriptions")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            status: "active",
            stripe_event_id: event.id,
          })
          .eq("organization_id", organizationId);
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.parent?.subscription_details?.subscription as string | undefined;
      if (subscriptionId) {
        await supabase
          .from("subscriptions")
          .update({ status: "active", stripe_event_id: event.id })
          .eq("stripe_subscription_id", subscriptionId);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.parent?.subscription_details?.subscription as string | undefined;
      if (subscriptionId) {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due", stripe_event_id: event.id })
          .eq("stripe_subscription_id", subscriptionId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", stripe_event_id: event.id })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
