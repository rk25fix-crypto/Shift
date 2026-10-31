import Link from "next/link";
import { Building2, ChevronRight, CreditCard, Printer, Repeat, Tag } from "lucide-react";
import { MenuSection } from "@/components/ui/Section";
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

  const manager = isManager(role);
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
      {/* Kept outside the folds: which org you're in is context, not a setting to dig for. */}
      {allMemberships.length > 1 && (
        <OrgSwitcher memberships={allMemberships} currentOrgId={organizationId} />
      )}
      <div className="flex flex-col gap-2">
        <MenuSection icon={Tag} title="シフトの決まり" summary="シフト種別・時間・毎日必須の勤務">
          <MenuLink href="/settings/shift-types" label="シフト種別の設定" />
        </MenuSection>
        <MenuSection icon={Repeat} title="交代" summary="交代の申請・申請の一覧">
          <MenuLink href="/swaps" label="交代の申請・一覧" />
        </MenuSection>
        <MenuSection
          icon={Printer}
          title="印刷・レポート"
          summary={manager ? "シフト表の印刷・稼働レポート" : "シフト表の印刷"}
        >
          <p className="text-xs font-bold text-ink-weak">シフト表の印刷</p>
          <PrintLinkForm organizationId={organizationId} />
          {manager && <MenuLink href="/settings/reports" label="稼働レポート" />}
        </MenuSection>
        <MenuSection
          icon={CreditCard}
          title={manager ? "お支払い・履歴" : "お支払い"}
          summary={manager ? "プラン・お支払い・変更履歴" : "プラン・お支払い"}
        >
          <MenuLink href="/billing" label="お支払い・プラン" />
          {manager && <MenuLink href="/settings/audit-log" label="変更履歴" />}
        </MenuSection>
        {role === "owner" && (
          <MenuSection icon={Building2} title="事業所" summary="事業所の削除">
            <DeleteOrganizationButton organizationName={organizationName} />
          </MenuSection>
        )}
      </div>
    </div>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[12px] bg-primary-soft px-4 py-3 text-sm font-bold text-primary-ink"
    >
      {label}
      <ChevronRight size={16} />
    </Link>
  );
}
