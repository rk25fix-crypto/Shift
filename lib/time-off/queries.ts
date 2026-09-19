import { and, eq, gte, lt } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { timeOffRequests } from "@/drizzle/schema";

export interface TimeOff {
  staffId: string;
  date: string;
}

/** Time-off requests for `[startDate, endDateExclusive)` — used by the Today/Week views and (later) auto-generation. */
export async function listTimeOffForRange(
  organizationId: string,
  startDate: string,
  endDateExclusive: string,
): Promise<TimeOff[]> {
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select({ staffId: timeOffRequests.staffId, date: timeOffRequests.date })
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.organizationId, organizationId),
        gte(timeOffRequests.date, startDate),
        lt(timeOffRequests.date, endDateExclusive),
      ),
    );

  return rows;
}
