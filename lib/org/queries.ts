import { eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { organizations } from "@/drizzle/schema";
import { DEFAULT_WORK_RULE_SETTINGS, type WorkRuleSettings } from "@/lib/labor-rules";

/**
 * Reads an org's 勤務ルール警告 thresholds. Deliberately not in
 * lib/org/current.ts — that file is allow-listed for the raw D1 client
 * (eslint.config.mjs) because it's the one place that must resolve
 * organizationId before any scoped query is possible; every other org
 * lookup, this one included, goes through getScopedDb like any other table.
 */
export async function getWorkRuleSettings(organizationId: string): Promise<WorkRuleSettings> {
  const { db } = getScopedDb(organizationId);
  const [row] = await db
    .select({
      maxConsecutiveDays: organizations.maxConsecutiveDays,
      maxWeeklyHours: organizations.maxWeeklyHours,
      maxMonthlyHours: organizations.maxMonthlyHours,
      minBreakMinutesOverSixHours: organizations.minBreakMinutesOverSixHours,
      minBreakMinutesOverEightHours: organizations.minBreakMinutesOverEightHours,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row ?? DEFAULT_WORK_RULE_SETTINGS;
}
