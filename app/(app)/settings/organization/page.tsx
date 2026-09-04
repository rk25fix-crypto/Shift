import Link from "next/link";

export default function OrganizationSettingsPage() {
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
      <p className="text-sm text-gray-500">
        Phase 1a で事業所名・タイムゾーン、Phase 1b で勤務ルール(連勤上限・週/月上限時間)の設定を実装します。
      </p>
    </div>
  );
}
