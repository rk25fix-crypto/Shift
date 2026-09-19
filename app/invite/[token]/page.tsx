import { getInvitePreview } from "@/lib/staff-invites/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { InviteClaimForm } from "@/components/staff/InviteClaimForm";

const ERROR_MESSAGE = {
  claimed: "この招待リンクはすでに使用されています。管理者に新しいリンクの発行を依頼してください。",
  expired: "この招待リンクは期限切れです。管理者に新しいリンクの発行を依頼してください。",
  not_found: "招待リンクが見つかりません。URLをもう一度確認してください。",
} as const;

/** スタッフ本人が招待リンクから名前を確認し、固定休・入れないシフトを入力する画面(design handoff 2i)。 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getInvitePreview(token);
  const shiftTypes = preview.status === "valid" ? await listShiftTypes(preview.organizationId) : [];

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      {preview.status === "valid" ? (
        <InviteClaimForm token={token} staffName={preview.staffName} shiftTypes={shiftTypes} />
      ) : (
        <p className="max-w-xs text-center text-sm text-ink-weak">{ERROR_MESSAGE[preview.status]}</p>
      )}
    </main>
  );
}
