import type { AuditLogEntry } from "@/lib/audit/queries";

const ACTION_LABEL: Record<AuditLogEntry["action"], string> = {
  create: "作成",
  update: "変更",
  delete: "削除",
};

const ENTITY_LABEL: Record<AuditLogEntry["entity"], string> = {
  staff: "スタッフ",
  shift_type: "シフト種別",
  shift_assignment: "シフト割当",
};

function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function describeDiff(entry: AuditLogEntry): string | null {
  const diff = entry.diff;
  if (!diff) return null;
  if (entry.entity === "staff" && typeof diff.name === "string") return diff.name;
  if (entry.entity === "shift_type" && typeof diff.name === "string") {
    return typeof diff.code === "string" ? `${diff.code} ${diff.name}` : diff.name;
  }
  if (entry.entity === "shift_assignment" && typeof diff.date === "string") return diff.date;
  return null;
}

export function AuditLogList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="px-4 py-6 text-sm text-gray-500">まだ変更履歴はありません。</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {entries.map((entry) => {
        const detail = describeDiff(entry);
        return (
          <li key={entry.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {ENTITY_LABEL[entry.entity]}を{ACTION_LABEL[entry.action]}
                {detail && `(${detail})`}
              </span>
              <span className="text-xs text-gray-400">{formatDateTime(entry.createdAt)}</span>
            </div>
            <p className="text-xs text-gray-500">{entry.actorName ?? "システム"}</p>
          </li>
        );
      })}
    </ul>
  );
}
