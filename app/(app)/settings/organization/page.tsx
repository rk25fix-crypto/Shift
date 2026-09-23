import Link from "next/link";
import { BarChart3, CreditCard, History, Repeat, Tag } from "lucide-react";
import {
  isManager,
  listMembershipsForCurrentUser,
  requireCurrentMembership,
  type MembershipRole,
} from "@/lib/org/current";
import { PrintLinkForm } from "@/components/shift/PrintLinkForm";
import { OrgSwitcher } from "@/components/settings/OrgSwitcher";
import { DeleteOrganizationButton } from "@/components/settings/DeleteOrganizationButton";

const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  staff: "スタッフ",
};

export default async function OrganizationSettingsPage() {
  const { organizationId, role } = await requireCurrentMembership();
  const allMemberships = await listMembershipsForCurrentUser();
  const organizationName = allMemberships.find((m) => m.organizationId === organizationId)?.organizationName ?? "";

  const links = [
    isManager(role) && { href: "/settings/reports", label: "稼働レポート", icon: BarChart3 },
    { href: "/swaps", label: "交代の申請・一覧", icon: Repeat },
    { href: "/settings/shift-types", label: "シフト種別の設定", icon: Tag },
    isManager(role) && { href: "/settings/audit-log", label: "変更履歴", icon: History },
    { href: "/billing", label: "お支払い・プラン", icon: CreditCard },
  ].filter((link): link is { href: string; label: string; icon: typeof BarChart3 } => Boolean(link));

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">設定</h1>
        <p className="mt-1 text-sm text-ink-weak">
          {organizationName}・
          <span className="font-bold text-primary-ink">{ROLE_LABEL[role]}</span>
          として利用中
        </p>
      </div>
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
      {role === "owner" && (
        <div className="mt-4 border-t border-border pt-4">
          <DeleteOrganizationButton organizationName={organizationName} />
        </div>
      )}
    </div>
  );
}
