import Link from "next/link";
import { requireCurrentMembership } from "@/lib/org/current";
import { PrintLinkForm } from "@/components/shift/PrintLinkForm";

export default async function OrganizationSettingsPage() {
  const { organizationId } = await requireCurrentMembership();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold">設定</h1>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <Link href="/settings/shift-types" className="text-indigo-600">
            シフト種別の設定
          </Link>
        </li>
        <li>
          <Link href="/billing" className="text-indigo-600">
            お支払い・プラン
          </Link>
        </li>
      </ul>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">シフト表の印刷</p>
        <PrintLinkForm organizationId={organizationId} />
      </div>
      <p className="text-sm text-gray-500">
        事業所名・タイムゾーンの編集、勤務ルール(連勤上限・週/月上限時間)の警告表示・しきい値変更は今後実装予定です。
      </p>
    </div>
  );
}
