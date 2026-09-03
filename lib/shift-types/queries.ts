import { and, asc, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { shiftTypes } from "@/drizzle/schema";

export interface ShiftTypeRecord {
  id: string;
  code: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  crossesMidnight: boolean;
  breakMinutes: number;
  isRequired: boolean;
  isBalanced: boolean;
  colorKey: string | null;
  sortOrder: number;
}

export async function listShiftTypes(organizationId: string): Promise<ShiftTypeRecord[]> {
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select()
    .from(shiftTypes)
    .where(eq(shiftTypes.organizationId, organizationId))
    .orderBy(asc(shiftTypes.sortOrder), asc(shiftTypes.code));

  return rows.map(toShiftTypeRecord);
}

export async function getShiftType(
  organizationId: string,
  shiftTypeId: string,
): Promise<ShiftTypeRecord | null> {
  const { db } = getScopedDb(organizationId);
  const [row] = await db
    .select()
    .from(shiftTypes)
    .where(and(eq(shiftTypes.organizationId, organizationId), eq(shiftTypes.id, shiftTypeId)))
    .limit(1);

  return row ? toShiftTypeRecord(row) : null;
}

type ShiftTypeRow = typeof shiftTypes.$inferSelect;

function toShiftTypeRecord(row: ShiftTypeRow): ShiftTypeRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    crossesMidnight: row.crossesMidnight,
    breakMinutes: row.breakMinutes,
    isRequired: row.isRequired,
    isBalanced: row.isBalanced,
    colorKey: row.colorKey,
    sortOrder: row.sortOrder,
  };
}
