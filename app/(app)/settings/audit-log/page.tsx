import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { listRecentAuditLog } from "@/lib/audit/queries";
import { AuditLogList } from "@/components/settings/AuditLogList";

export default async function AuditLogPage() {
  const { organizationId, role } = await requireCurrentMembership();

  if (!isManager(role)) {
    return <p className="px-4 py-6 text-sm text-gray-500">この画面を見る権限がありません。</p>;
  }

  const entries = await listRecentAuditLog(organizationId);

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <h1 className="px-4 text-xl font-bold">変更履歴</h1>
      <p className="px-4 text-xs text-gray-400">
        スタッフ・シフト種別の変更と、今日ビュー・週表示での個別のシフト割当変更を、新しい順に最大100件まで表示しています。自動生成・下書きの一括確定/破棄は含まれません。
      </p>
      <AuditLogList entries={entries} />
    </div>
  );
}
