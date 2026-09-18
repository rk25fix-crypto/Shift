import { requireCurrentMembership } from "@/lib/org/current";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { listSwapRequests } from "@/lib/swaps/queries";
import { SwapRequestForm } from "@/components/shift/SwapRequestForm";
import { SwapRequestList } from "@/components/shift/SwapRequestList";

export default async function SwapsPage() {
  const { organizationId } = await requireCurrentMembership();
  const [staff, shiftTypes, requests] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    listSwapRequests(organizationId),
  ]);

  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));
  const shiftTypeLabelById = new Map(shiftTypes.map((t) => [t.id, `${t.code} ${t.name}`]));

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <h1 className="px-4 text-xl font-bold">交代申請</h1>

      <section className="flex flex-col gap-3">
        <h2 className="px-4 text-sm font-medium text-gray-600">新しい交代申請</h2>
        <SwapRequestForm staff={staff} shiftTypes={shiftTypes} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-4 text-sm font-medium text-gray-600">申請一覧</h2>
        <SwapRequestList
          requests={requests}
          staffNameById={staffNameById}
          shiftTypeLabelById={shiftTypeLabelById}
        />
      </section>
    </div>
  );
}
