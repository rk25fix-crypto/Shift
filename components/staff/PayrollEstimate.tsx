import type { StaffPayrollEstimate } from "@/lib/shifts/payroll";

interface PayrollEstimateProps {
  estimate: StaffPayrollEstimate;
}

/**
 * 給与概算 — 確定済みシフトの勤務時間 × 時給に、深夜(22-5時)・残業(1日8h/
 * 週40h超)・法定休日(日曜と仮定)の割増を加えた概算(lib/payroll.ts)。
 * あくまで概算であり、実際の給与計算・法令判断を代替しないことを明示する
 * (docs/plan.md「労基法違反という表現はUI上使わない」方針)。
 */
export function PayrollEstimate({ estimate }: PayrollEstimateProps) {
  const { nightHours, overtimeHours, holidayHours } = estimate.premiums;
  const premiumNotes = [
    nightHours > 0 && `深夜${nightHours}h`,
    overtimeHours > 0 && `残業${overtimeHours}h`,
    holidayHours > 0 && `休日${holidayHours}h`,
  ].filter(Boolean);

  return (
    <div
      className="mx-4 flex flex-col gap-1 rounded-[18px] border p-4"
      style={{ borderColor: "var(--color-success-border)", background: "var(--color-success-soft)" }}
    >
      <p className="text-sm font-bold" style={{ color: "var(--color-success-ink)" }}>
        今月の給与概算
      </p>
      <p
        className="font-heading text-[30px] font-black"
        style={{ color: "var(--color-success-ink-strong)" }}
      >
        ¥{estimate.estimatedPay.toLocaleString("ja-JP")}
      </p>
      <p className="text-xs" style={{ color: "var(--color-success-ink)" }}>
        {estimate.totalHours}時間 × 時給¥{estimate.hourlyWage.toLocaleString("ja-JP")}
        {premiumNotes.length > 0 && `(内 ${premiumNotes.join("・")} 割増を含む)`}
      </p>
      <p className="text-xs text-ink-weakest">
        深夜・残業・法定休日(日曜と仮定)の割増を含む概算です。実際の給与計算を代替するものではありません
      </p>
    </div>
  );
}
