import Link from "next/link";
import type { StaffRecord } from "@/lib/staff/queries";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function StaffList({ staff }: { staff: StaffRecord[] }) {
  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <p className="text-sm text-ink-weak">まだスタッフが登録されていません。</p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Link
            href="/staff/new"
            className="rounded-full px-6 py-3 text-sm font-bold font-heading text-white"
            style={{ background: "var(--color-primary)" }}
          >
            自分で入れる
          </Link>
          <Link
            href="/staff/new?invite=1"
            className="rounded-full border border-border px-6 py-3 text-sm font-bold text-ink-weak"
          >
            リンクを送る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {staff.map((member) => (
        <li key={member.id}>
          <Link href={`/staff/${member.id}`} className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-base font-bold text-ink">{member.name}</p>
              <p className="text-sm text-ink-weak">
                {member.roleLabel && `${member.roleLabel} ・ `}
                固定休:{" "}
                {member.fixedDaysOff.length > 0
                  ? member.fixedDaysOff.map((d) => DAY_LABELS[d]).join("・")
                  : "なし"}
              </p>
            </div>
            <span aria-hidden className="text-ink-weakest">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
