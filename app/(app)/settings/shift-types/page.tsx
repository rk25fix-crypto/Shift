import Link from "next/link";
import { requireCurrentMembership } from "@/lib/org/current";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { ShiftTypeList } from "@/components/shift-types/ShiftTypeList";
import { ShiftTypePresets } from "@/components/shift-types/ShiftTypePresets";

export default async function ShiftTypesSettingsPage() {
  const { organizationId } = await requireCurrentMembership();
  const shiftTypes = await listShiftTypes(organizationId);

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-xl font-bold">シフト種別の設定</h1>
        <Link href="/settings/shift-types/new" className="text-sm font-medium text-indigo-600">
          + 追加
        </Link>
      </div>
      <ShiftTypePresets />
      <ShiftTypeList shiftTypes={shiftTypes} />
    </div>
  );
}
