import Link from "next/link";
import { requireCurrentMembership } from "@/lib/org/current";
import { listStaff } from "@/lib/staff/queries";
import { StaffList } from "@/components/staff/StaffList";

export default async function StaffListPage() {
  const { organizationId } = await requireCurrentMembership();
  const staff = await listStaff(organizationId);

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-xl font-bold font-heading text-ink">スタッフ</h1>
        <Link href="/staff/new" className="text-sm font-bold text-primary-ink">
          + 追加
        </Link>
      </div>
      <StaffList staff={staff} />
    </div>
  );
}
