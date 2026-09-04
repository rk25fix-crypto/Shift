import { requireCurrentMembership } from "@/lib/org/current";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { StaffForm } from "@/components/staff/StaffForm";

export default async function NewStaffPage() {
  const { organizationId, role } = await requireCurrentMembership();
  const shiftTypes = await listShiftTypes(organizationId);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-6 text-xl font-bold">スタッフを追加</h1>
      <StaffForm shiftTypes={shiftTypes} canEditCompensation={role === "owner"} />
    </div>
  );
}
