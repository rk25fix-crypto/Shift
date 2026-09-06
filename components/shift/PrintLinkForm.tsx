"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { monthOf, todayInTimezone } from "@/lib/date";

/**
 * The print view lives at /print/[orgId]/[month] (a path segment, not a
 * query param), so picking a month needs a tiny bit of client-side routing
 * rather than a plain GET form.
 */
export function PrintLinkForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(monthOf(todayInTimezone()));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/print/${organizationId}/${month}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <button type="submit" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600">
        印刷用シフト表を開く
      </button>
    </form>
  );
}
