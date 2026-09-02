export default async function PrintSchedulePage({
  params,
}: {
  params: Promise<{ orgId: string; month: string }>;
}) {
  const { orgId, month } = await params;

  return (
    <main className="p-8 print:p-0">
      <h1 className="text-lg font-bold">
        {month} のシフト表(事業所: {orgId})
      </h1>
      <p className="text-sm text-gray-500">
        Phase 1a で印刷専用のフル月間グリッドをここに実装します。インタラクティブUIとは別ルートに分離し、
        window.print() 用のスタイルをこのページだけに適用します。
      </p>
    </main>
  );
}
