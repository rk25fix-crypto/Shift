import { notFound } from "next/navigation";
import { requireCurrentMembership } from "@/lib/org/current";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForOrgMonth } from "@/lib/shifts/queries";
import { datesInMonth } from "@/lib/date";

export default async function PrintSchedulePage({
  params,
}: {
  params: Promise<{ orgId: string; month: string }>;
}) {
  const { orgId, month } = await params;
  const { organizationId } = await requireCurrentMembership();

  // The URL carries orgId for a readable/shareable link, but access is
  // still governed by the caller's own membership — a mismatch here means
  // "not your organization", not a lookup by arbitrary orgId.
  if (orgId !== organizationId) notFound();

  const [staff, shiftTypes, assignments] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    getAssignmentsForOrgMonth(organizationId, month),
  ]);

  const dates = datesInMonth(month);
  const shiftTypeById = new Map(shiftTypes.map((s) => [s.id, s]));
  const codeByStaffDate = new Map(
    assignments.map((a) => [`${a.staffId}|${a.date}`, shiftTypeById.get(a.shiftTypeId)?.code ?? ""]),
  );

  return (
    <main className="p-4 print:p-0">
      <h1 className="mb-4 text-lg font-bold">{month} のシフト表</h1>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 border border-gray-300 bg-white px-2 py-1 text-left">
                スタッフ
              </th>
              {dates.map((date) => (
                <th key={date} className="border border-gray-300 px-2 py-1 text-center">
                  {Number(date.slice(8, 10))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id}>
                <th className="sticky left-0 border border-gray-300 bg-white px-2 py-1 text-left font-normal">
                  {member.name}
                </th>
                {dates.map((date) => (
                  <td key={date} className="border border-gray-300 px-2 py-1 text-center">
                    {codeByStaffDate.get(`${member.id}|${date}`) ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
