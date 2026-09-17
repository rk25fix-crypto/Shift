import Link from "next/link";
import { isManager, requireCurrentMembership } from "@/lib/org/current";
import { getHoursReport } from "@/lib/shifts/hours-report";
import { monthOf, nextMonth, prevMonth, todayInTimezone } from "@/lib/date";
import { HoursBarChart } from "@/components/reports/HoursBarChart";

/** 管理者専用の稼働レポート — 誰がどの勤務で何時間働いたか(design intent: スタッフ本人には見せない、/staff-homeには置かない)。 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { organizationId, role } = await requireCurrentMembership();

  if (!isManager(role)) {
    return <p className="px-4 py-6 text-sm text-ink-weak">この画面を見る権限がありません。</p>;
  }

  const { month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthOf(todayInTimezone());
  const monthStart = `${month}-01`;
  const monthEndExclusive = `${nextMonth(month)}-01`;

  const report = await getHoursReport(organizationId, monthStart, monthEndExclusive);
  const monthLabel = month.replace("-", "年") + "月";

  return (
    <div className="flex flex-1 flex-col gap-4 py-6">
      <div className="flex items-center justify-between px-4">
        <Link href={`/settings/reports?month=${prevMonth(month)}`} aria-label="前の月" className="p-2 text-xl text-ink-weak">
          ‹
        </Link>
        <h1 className="text-lg font-bold font-heading text-ink">{monthLabel}の稼働</h1>
        <Link href={`/settings/reports?month=${nextMonth(month)}`} aria-label="次の月" className="p-2 text-xl text-ink-weak">
          ›
        </Link>
      </div>
      <p className="px-4 text-xs text-ink-weakest">
        確定済みのシフトのみを集計しています(下書きは含みません)。
      </p>
      {report.rows.length === 0 ? (
        <p className="px-4 text-sm text-ink-weak">この月はまだ確定済みのシフトがありません。</p>
      ) : (
        <HoursBarChart report={report} />
      )}
    </div>
  );
}
