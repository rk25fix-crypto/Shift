import { notFound } from "next/navigation";
import { requireCurrentMembership } from "@/lib/org/current";
import { getStaff, getStaffHourlyWage } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { StaffForm } from "@/components/staff/StaffForm";
import { DeactivateStaffButton } from "@/components/staff/DeactivateStaffButton";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  const { organizationId, role } = await requireCurrentMembership();

  const staff = await getStaff(organizationId, staffId);
  if (!staff) notFound();

  const canEditCompensation = role === "owner";
  const [shiftTypes, hourlyWage] = await Promise.all([
    listShiftTypes(organizationId),
    canEditCompensation ? getStaffHourlyWage(staffId) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-6 text-xl font-bold">{staff.name}</h1>
      <StaffForm
        existing={staff}
        existingHourlyWage={hourlyWage}
        shiftTypes={shiftTypes}
        canEditCompensation={canEditCompensation}
      />
      <div className="px-4 pb-6">
        <DeactivateStaffButton staffId={staff.id} />
      </div>
    </div>
  );
}
