import { notFound } from "next/navigation";
import { requireCurrentMembership } from "@/lib/org/current";
import { getShiftType } from "@/lib/shift-types/queries";
import { ShiftTypeForm } from "@/components/shift-types/ShiftTypeForm";
import { DeleteShiftTypeButton } from "@/components/shift-types/DeleteShiftTypeButton";

export default async function EditShiftTypePage({
  params,
}: {
  params: Promise<{ shiftTypeId: string }>;
}) {
  const { shiftTypeId } = await params;
  const { organizationId } = await requireCurrentMembership();
  const shiftType = await getShiftType(organizationId, shiftTypeId);

  if (!shiftType) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-6 text-xl font-bold">シフト種別を編集</h1>
      <ShiftTypeForm existing={shiftType} />
      <div className="px-4 pb-6">
        <DeleteShiftTypeButton shiftTypeId={shiftType.id} />
      </div>
    </div>
  );
}
