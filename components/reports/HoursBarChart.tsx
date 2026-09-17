import type { HoursReport } from "@/lib/shifts/hours-report";
import { shiftTypeColor } from "@/lib/shift-types/colors";

interface HoursBarChartProps {
  report: HoursReport;
}

const CHART_HEIGHT = 200;
/** Y-axis gridlines as a fraction of maxHours, drawn bottom (0) to top (1). */
const GRID_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

/**
 * CSS製の積み上げ縦棒グラフ — 縦軸を実働時間にして、スタッフを横に並べ
 * 比較しやすくする(「誰がどの勤務で何時間働いたか」)。チャートライブラリ
 * は追加しない — 棒の高さは全体に対する割合で計算するだけなので、divの
 * 高さ指定で十分。スタッフ数が多い場合はグラフ部分だけ横スクロール
 * (ページ全体は横スクロールさせない、という既存の方針に合わせる)。
 */
export function HoursBarChart({ report }: HoursBarChartProps) {
  const shiftTypeIndexById = new Map(report.shiftTypes.map((t, i) => [t.id, i]));
  const maxHours = Math.max(...report.rows.map((r) => r.totalHours), 1);
  // Round the axis max up to a clean multiple of 5 so gridline labels are readable numbers.
  const axisMax = Math.ceil(maxHours / 5) * 5;

  return (
    <div className="flex flex-col gap-5 px-4">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[10px] text-ink-weakest" style={{ height: CHART_HEIGHT }}>
          {[...GRID_FRACTIONS].reverse().map((f) => (
            <span key={f}>{Math.round(axisMax * f)}h</span>
          ))}
        </div>
        <div className="relative flex-1 overflow-x-auto">
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
            {[...GRID_FRACTIONS].reverse().map((f) => (
              <div key={f} className="border-t" style={{ borderColor: "var(--color-border-subtle)" }} />
            ))}
          </div>
          <div className="relative flex items-end gap-4 pl-1" style={{ height: CHART_HEIGHT }}>
            {report.rows.map((row) => (
              <div key={row.staffId} className="flex w-14 shrink-0 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-ink-weak">{row.totalHours.toFixed(1)}h</span>
                <div className="flex w-8 flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: (row.totalHours / axisMax) * CHART_HEIGHT }}>
                  {row.byShiftType.map((t) => {
                    const color = shiftTypeColor(shiftTypeIndexById.get(t.shiftTypeId) ?? 0);
                    const segmentHeight = (t.hours / axisMax) * CHART_HEIGHT;
                    return (
                      <div
                        key={t.shiftTypeId}
                        title={`${t.code} ${t.name}: ${t.hours.toFixed(1)}時間`}
                        style={{ height: segmentHeight, background: color.bg }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div style={{ width: 24 }} />
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 pl-1">
            {report.rows.map((row) => (
              <span key={row.staffId} className="w-14 shrink-0 truncate text-center text-xs font-bold text-ink">
                {row.staffName}
              </span>
            ))}
          </div>
        </div>
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
