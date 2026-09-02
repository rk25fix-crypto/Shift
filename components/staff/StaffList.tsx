import Link from "next/link";
import type { StaffRecord } from "@/lib/staff/queries";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function StaffList({ staff }: { staff: StaffRecord[] }) {
  if (staff.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-500">
        まだスタッフが登録されていません。「+ 追加」から最初のスタッフを登録してください。
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {staff.map((member) => (
        <li key={member.id}>
          <Link href={`/staff/${member.id}`} className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-base font-medium">{member.name}</p>
              <p className="text-sm text-gray-500">
                {member.roleLabel && `${member.roleLabel} ・ `}
                固定休:{" "}
                {member.fixedDaysOff.length > 0
                  ? member.fixedDaysOff.map((d) => DAY_LABELS[d]).join("・")
                  : "なし"}
              </p>
            </div>
            <span aria-hidden className="text-gray-400">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
