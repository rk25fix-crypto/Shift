import { eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { subscriptions } from "@/drizzle/schema";

export interface SubscriptionRecord {
  plan: "trial" | "standard" | "pro";
  status: "trialing" | "active" | "past_due" | "canceled";
  trialEndsAt: Date | null;
}

export async function getSubscription(organizationId: string): Promise<SubscriptionRecord | null> {
  const { db } = getScopedDb(organizationId);
  const [row] = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  return row ?? null;
}
