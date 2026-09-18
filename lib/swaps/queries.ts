import { desc, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { swapRequests } from "@/drizzle/schema";

export interface SwapRequestRecord {
  id: string;
  date: string;
  fromStaffId: string;
  toStaffId: string;
  fromShiftTypeId: string | null;
  toShiftTypeId: string | null;
  status: "pending" | "approved" | "rejected";
}

/** All swap requests for the org, newest first — pending and already-decided alike, so the /swaps page can show both. */
export async function listSwapRequests(organizationId: string): Promise<SwapRequestRecord[]> {
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select()
    .from(swapRequests)
    .where(eq(swapRequests.organizationId, organizationId))
    .orderBy(desc(swapRequests.createdAt));

  return rows.map(toSwapRequestRecord);
}

type SwapRequestRow = typeof swapRequests.$inferSelect;

function toSwapRequestRecord(row: SwapRequestRow): SwapRequestRecord {
  return {
    id: row.id,
    date: row.date,
    fromStaffId: row.fromStaffId,
    toStaffId: row.toStaffId,
    fromShiftTypeId: row.fromShiftTypeId,
    toShiftTypeId: row.toShiftTypeId,
    status: row.status,
  };
}
