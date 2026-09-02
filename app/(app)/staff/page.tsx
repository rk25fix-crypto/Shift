export default function StaffListPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold">スタッフ</h1>
      <p className="text-sm text-gray-500">
        Phase 1a でスタッフCRUD(氏名・固定休・不可シフト)を実装します。時給は staff_compensation
        テーブルに分離し、owner のみが閲覧できます(docs/plan.md 参照)。
      </p>
    </div>
  );
}
