import type { HoursReport } from "@/lib/shifts/hours-report";
import { shiftTypeColor } from "@/lib/shift-types/colors";

interface HoursBarChartProps {
  report: HoursReport;
}

/**
 * CSS製の積み上げ横棒グラフ — スタッフごとに、その月に確定済みで働いた
 * シフト種別ごとの時間を色分けして表示する(「誰がどの勤務で何時間
 * 働いたか」)。チャートライブラリは追加しない — 棒の幅は全体に対する
 * 割合で計算するだけなので、divの幅指定で十分。
 */
export function HoursBarChart({ report }: HoursBarChartProps) {
  const shiftTypeIndexById = new Map(report.shiftTypes.map((t, i) => [t.id, i]));
  const maxHours = Math.max(...report.rows.map((r) => r.totalHours));

  return (
    <div className="flex flex-col gap-5 px-4">
      <div className="flex flex-col gap-4">
        {report.rows.map((row) => (
          <div key={row.staffId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-ink">{row.staffName}</span>
              <span className="text-xs font-bold text-ink-weak">{row.totalHours.toFixed(1)}時間</span>
            </div>
            <div className="flex h-6 w-full overflow-hidden rounded-[6px]" style={{ background: "var(--color-border-subtle)" }}>
              {row.byShiftType.map((t) => {
                const color = shiftTypeColor(shiftTypeIndexById.get(t.shiftTypeId) ?? 0);
                const widthPercent = maxHours > 0 ? (t.hours / maxHours) * 100 : 0;
                return (
                  <div
                    key={t.shiftTypeId}
                    title={`${t.code} ${t.name}: ${t.hours.toFixed(1)}時間`}
                    style={{ width: `${widthPercent}%`, background: color.bg }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {report.shiftTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-ink-weakest">
          {report.shiftTypes.map((t, i) => {
            const color = shiftTypeColor(i);
            return (
              <span key={t.id} className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: color.bg, color: color.text }}>
                {t.code} {t.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
