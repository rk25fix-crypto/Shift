import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <h1 className="max-w-md text-3xl font-bold leading-tight">
        シフト管理を、iPhoneひとつで。
      </h1>
      <p className="max-w-sm text-base leading-7 text-gray-600">
        パソコンが苦手な管理者でも、スタッフのシフトをiPhoneでサクッと作成・調整できます。
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-full bg-indigo-600 px-8 py-3 text-base font-medium text-white"
        >
          無料で試す
        </Link>
        <Link
          href="/pricing"
          className="rounded-full border border-gray-300 px-8 py-3 text-base font-medium"
        >
          料金を見る
        </Link>
      </div>
    </main>
  );
}
