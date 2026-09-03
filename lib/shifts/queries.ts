import { and, eq, gte, lt } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { shiftAssignments } from "@/drizzle/schema";
import { monthOf, nextMonth } from "@/lib/date";

export interface Assignment {
  id: string;
  staffId: string;
  shiftTypeId: string;
  date: string;
}

export async function getAssignmentsForDate(
  organizationId: string,
  date: string,
): Promise<Assignment[]> {
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.date, date),
        eq(shiftAssignments.status, "confirmed"),
      ),
    );

  return rows.map(toAssignment);
}

export async function getAssignmentsForStaffMonth(
  organizationId: string,
  staffId: string,
  date: string,
): Promise<Assignment[]> {
  const month = monthOf(date);
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.staffId, staffId),
        eq(shiftAssignments.status, "confirmed"),
        gte(shiftAssignments.date, `${month}-01`),
        lt(shiftAssignments.date, `${nextMonth(month)}-01`),
      ),
    )
    .orderBy(shiftAssignments.date);

  return rows.map(toAssignment);
}

export async function getAssignmentsForOrgMonth(
  organizationId: string,
  month: string,
): Promise<Assignment[]> {
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.organizationId, organizationId),
        eq(shiftAssignments.status, "confirmed"),
        gte(shiftAssignments.date, `${month}-01`),
        lt(shiftAssignments.date, `${nextMonth(month)}-01`),
      ),
    )
    .orderBy(shiftAssignments.date);

  return rows.map(toAssignment);
}

type AssignmentRow = typeof shiftAssignments.$inferSelect;

function toAssignment(row: AssignmentRow): Assignment {
  return { id: row.id, staffId: row.staffId, shiftTypeId: row.shiftTypeId, date: row.date };
}
