export default function PricingPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-6 py-24 text-center">
      <h1 className="font-heading text-2xl font-black text-ink">料金プラン</h1>
      <p className="max-w-sm text-ink-weak">
        1事業所につき定額の月額制です。まずは14日間、カード登録なしでお試しいただけます。
      </p>
      <p className="text-sm text-ink-weakest">(価格は Phase 2 で確定します)</p>
    </main>
  );
}
