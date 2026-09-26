import { requireCurrentMembership } from "@/lib/org/current";
import { getSubscription } from "@/lib/subscriptions/queries";
import { PlanToggle } from "@/components/billing/PlanToggle";

function trialDaysRemaining(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  const diffMs = trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export default async function BillingPage() {
  const { organizationId } = await requireCurrentMembership();
  const subscription = await getSubscription(organizationId);
  const trialDays =
    subscription?.status === "trialing" ? trialDaysRemaining(subscription.trialEndsAt) : null;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold font-heading text-ink">お支払い・プラン</h1>

      {trialDays !== null && (
        <div className="rounded-[18px] border border-warn-border bg-warn-soft px-4 py-3">
          <p className="text-sm font-bold text-warn-ink">無料トライアル残り {trialDays} 日</p>
          <p className="mt-1 text-xs text-warn-ink">トライアル終了後は下のプランでお支払いが必要です。</p>
        </div>
      )}

      <PlanToggle />

      <p className="text-xs text-ink-weak">終わってもシフトは消えません。</p>

      <p className="rounded-[16px] border border-border bg-surface px-4 py-3 text-sm text-ink-weak">
        お支払い方法の登録・変更・解約は Stripe の決済画面で行います(Phase 2 で実装予定)。
      </p>
    </div>
  );
}
