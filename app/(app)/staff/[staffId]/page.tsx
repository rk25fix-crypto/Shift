import { notFound } from "next/navigation";
import { requireCurrentMembership } from "@/lib/org/current";
import { getStaff, getStaffHourlyWage } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForStaffMonth } from "@/lib/shifts/queries";
import { todayInTimezone } from "@/lib/date";
import { StaffForm } from "@/components/staff/StaffForm";
import { StaffMonthShifts } from "@/components/staff/StaffMonthShifts";
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
  const [shiftTypes, hourlyWage, monthAssignments] = await Promise.all([
    listShiftTypes(organizationId),
    getStaffHourlyWage(organizationId, staffId, role),
    getAssignmentsForStaffMonth(organizationId, staffId, todayInTimezone()),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-6 text-xl font-bold">{staff.name}</h1>

      <section className="flex flex-col gap-2 py-6">
        <h2 className="px-4 text-sm font-semibold text-gray-500">今月のシフト</h2>
        <StaffMonthShifts assignments={monthAssignments} shiftTypes={shiftTypes} />
      </section>

      <h2 className="px-4 pb-2 text-sm font-semibold text-gray-500">編集</h2>
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
