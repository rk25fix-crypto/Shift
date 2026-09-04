import Link from "next/link";
import type { ShiftTypeRecord } from "@/lib/shift-types/queries";

export function ShiftTypeList({ shiftTypes }: { shiftTypes: ShiftTypeRecord[] }) {
  if (shiftTypes.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-500">
        まだシフト種別がありません。「+ 追加」から最初のシフトを登録してください。
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {shiftTypes.map((shiftType) => (
        <li key={shiftType.id}>
          <Link
            href={`/settings/shift-types/${shiftType.id}`}
            className="flex items-center justify-between px-4 py-4"
          >
            <div>
              <p className="text-base font-medium">
                {shiftType.code} {shiftType.name}
              </p>
              <p className="text-sm text-gray-500">
                {shiftType.startTime}〜{shiftType.endTime}
                {shiftType.crossesMidnight && "(翌日)"} ・ 休憩{shiftType.breakMinutes}分
                {shiftType.isRequired && " ・ 必須"}
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
