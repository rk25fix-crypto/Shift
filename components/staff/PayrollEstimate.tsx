import type { StaffPayrollEstimate } from "@/lib/shifts/payroll";

interface PayrollEstimateProps {
  estimate: StaffPayrollEstimate;
}

/**
 * 給与概算 — 確定済みシフトの勤務時間 × 時給のみ(lib/payroll.ts)。深夜・
 * 残業・法定休日の割増を含まないため、実際の支給額と異なることを明示する
 * (Phase 3で割増対応予定、docs/plan.md)。
 */
export function PayrollEstimate({ estimate }: PayrollEstimateProps) {
  return (
    <div className="mx-4 flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm font-medium text-gray-600">今月の給与概算</p>
      <p className="text-2xl font-bold text-gray-900">
        ¥{estimate.estimatedPay.toLocaleString("ja-JP")}
      </p>
      <p className="text-xs text-gray-500">
        {estimate.totalHours}時間 × 時給¥{estimate.hourlyWage.toLocaleString("ja-JP")}
      </p>
      <p className="text-xs text-gray-400">深夜・残業・休日などの割増は含みません</p>
    </div>
  );
}
