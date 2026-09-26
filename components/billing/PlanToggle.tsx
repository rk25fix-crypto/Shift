"use client";

import { useState } from "react";

const PLANS = {
  month: { label: "月額", price: "2,980円", period: "/月" },
  year: { label: "年額", price: "29,800円", period: "/年" },
} as const;

type Interval = keyof typeof PLANS;

/** Month/year plan toggle for the billing screen (design handoff 2f). Prices are provisional placeholders — see docs/plan.md "課金フロー(Stripe)" for why final pricing and Checkout wiring are out of scope for this pass. */
export function PlanToggle() {
  const [interval, setInterval] = useState<Interval>("month");
  const plan = PLANS[interval];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit rounded-full border border-border bg-surface p-1">
        {(Object.keys(PLANS) as Interval[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setInterval(key)}
            className="rounded-full px-4 py-1.5 text-sm font-bold"
            style={
              interval === key
                ? { background: "var(--color-primary)", color: "#ffffff" }
                : { color: "var(--color-ink-weak)" }
            }
          >
            {PLANS[key].label}
          </button>
        ))}
      </div>
      <div className="rounded-[20px] border-2 border-primary-soft-border bg-primary-soft px-5 py-4">
        <p className="font-heading text-2xl font-black text-primary-ink">
          {plan.price}
          <span className="ml-1 text-sm font-bold">{plan.period}</span>
        </p>
        <p className="mt-1 text-xs text-ink-weak">30人まで利用できます・価格は仮の数字です</p>
        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-full py-3 text-sm font-bold text-white opacity-60"
          style={{ background: "var(--color-primary)" }}
        >
          {plan.label}プランではじめる(近日公開)
        </button>
      </div>
    </div>
  );
}
