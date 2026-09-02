export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold">スタッフ詳細</h1>
      <p className="text-sm text-gray-500">
        Phase 1b で staffId={staffId} の月間シフトと勤務ルール警告を表示します。
      </p>
    </div>
  );
}
