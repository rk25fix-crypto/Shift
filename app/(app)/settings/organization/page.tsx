import Link from "next/link";
import { BarChart3, CreditCard, History, Repeat, Tag } from "lucide-react";
import { isManager, listMembershipsForCurrentUser, requireCurrentMembership } from "@/lib/org/current";
import { PrintLinkForm } from "@/components/shift/PrintLinkForm";
import { OrgSwitcher } from "@/components/settings/OrgSwitcher";

export default async function OrganizationSettingsPage() {
  const { organizationId, role } = await requireCurrentMembership();
  const allMemberships = await listMembershipsForCurrentUser();

  const links = [
    isManager(role) && { href: "/settings/reports", label: "稼働レポート", icon: BarChart3 },
    { href: "/swaps", label: "交代の申請・一覧", icon: Repeat },
    { href: "/settings/shift-types", label: "シフト種別の設定", icon: Tag },
    isManager(role) && { href: "/settings/audit-log", label: "変更履歴", icon: History },
    { href: "/billing", label: "お支払い・プラン", icon: CreditCard },
  ].filter((link): link is { href: string; label: string; icon: typeof BarChart3 } => Boolean(link));

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold">設定</h1>
      {allMemberships.length > 1 && (
        <OrgSwitcher memberships={allMemberships} currentOrgId={organizationId} />
      )}
      <ul className="flex flex-col gap-2">
        {links.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-4 text-sm font-bold text-ink"
            >
              <Icon size={20} color="var(--color-primary)" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">シフト表の印刷</p>
        <PrintLinkForm organizationId={organizationId} />
      </div>
    </div>
  );
}
