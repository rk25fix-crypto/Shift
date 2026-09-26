import { requireCurrentMembership } from "@/lib/org/current";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { StaffForm } from "@/components/staff/StaffForm";

export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const { organizationId, role } = await requireCurrentMembership();
  const shiftTypes = await listShiftTypes(organizationId);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-6 text-xl font-bold font-heading text-ink">スタッフを追加</h1>
      {invite === "1" && (
        <p className="px-4 pb-2 text-xs text-ink-weak">
          名前を入れて追加すると、次の画面で招待リンクを発行できます。
        </p>
      )}
      <StaffForm
        shiftTypes={shiftTypes}
        canEditCompensation={role === "owner"}
        afterCreateRedirect={invite === "1" ? "invite" : "list"}
      />
    </div>
  );
}
