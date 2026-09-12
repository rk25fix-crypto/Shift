"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { switchOrganization } from "@/lib/org/actions";
import type { OrgMembershipOption } from "@/lib/org/current";

interface OrgSwitcherProps {
  memberships: OrgMembershipOption[];
  currentOrgId: string;
}

/** Only rendered by the caller when memberships.length > 1 — a single-org user never sees this. */
export function OrgSwitcher({ memberships, currentOrgId }: OrgSwitcherProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSwitch(organizationId: string) {
    if (organizationId === currentOrgId || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await switchOrganization(organizationId);
      if (result.error) setError(result.error);
      else router.push("/today");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">事業所を切り替え</p>
      <ul className="flex flex-col gap-2">
        {memberships.map((m) => (
          <li key={m.organizationId}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSwitch(m.organizationId)}
              className={clsx(
                "w-full rounded-lg border px-4 py-3 text-left text-sm disabled:opacity-50",
                m.organizationId === currentOrgId
                  ? "border-indigo-600 bg-indigo-50 font-medium"
                  : "border-gray-200",
              )}
            >
              {m.organizationName}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
