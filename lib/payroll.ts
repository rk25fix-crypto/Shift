/**
 * Pure payroll estimate: worked hours × hourly wage, no premiums.
 * 深夜・時間外・法定休日の割増対応はPhase 3(docs/plan.md)。ここで出す金額は
 * あくまで概算であり、実給与計算を代替しないことをUI側で明示すること。
 */
import { workedHours, type WorkedShift } from "@/lib/labor-rules";

export interface PayrollEstimate {
  totalHours: number;
  estimatedPay: number;
}

export function estimatePayroll(shifts: WorkedShift[], hourlyWage: number): PayrollEstimate {
  const totalHours = shifts.reduce((sum, shift) => sum + workedHours(shift), 0);
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    estimatedPay: Math.round(totalHours * hourlyWage),
  };
}
