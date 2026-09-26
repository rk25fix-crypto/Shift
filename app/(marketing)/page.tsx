import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center"
      style={{ background: "var(--color-surface-hero)" }}
    >
      <h1 className="max-w-md font-heading text-3xl font-black leading-tight text-ink">
        シフト管理を、iPhoneひとつで。
      </h1>
      <p className="max-w-sm text-base leading-7 text-ink-weak">
        パソコンが苦手な管理者でも、スタッフのシフトをiPhoneでサクッと作成・調整できます。
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-full px-8 py-3 text-base font-bold font-heading text-white shadow-[0_8px_20px_rgba(196,96,31,.28)]"
          style={{ background: "var(--color-primary)" }}
        >
          無料で試す
        </Link>
        <Link
          href="/pricing"
          className="rounded-full border border-border px-8 py-3 text-base font-bold text-ink"
        >
          料金を見る
        </Link>
      </div>
    </main>
  );
}
