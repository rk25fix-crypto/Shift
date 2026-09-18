import { desc, eq } from "drizzle-orm";
import { getScopedDb } from "@/lib/db/scopedClient";
import { auditLog } from "@/drizzle/schema";
import { user } from "@/drizzle/auth-schema";
import type { AuditAction, AuditEntity } from "@/lib/audit/write";

export interface AuditLogEntry {
  id: string;
  actorName: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string | null;
  diff: Record<string, unknown> | null;
  createdAt: number; // unix seconds
}

const RECENT_LIMIT = 100;

/**
 * Most recent 変更履歴 entries for the org, newest first. Joins Better
 * Auth's `user` table (drizzle/auth-schema.ts, not org-scoped data itself)
 * only to resolve actorId to a display name — every row still comes from
 * auditLog filtered by this org's organizationId, so this can't surface
 * another org's history.
 */
export async function listRecentAuditLog(organizationId: string): Promise<AuditLogEntry[]> {
  const { db } = getScopedDb(organizationId);
  const rows = await db
    .select({
      id: auditLog.id,
      actorName: user.name,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      diff: auditLog.diff,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(eq(auditLog.organizationId, organizationId))
    .orderBy(desc(auditLog.createdAt))
    .limit(RECENT_LIMIT);

  return rows.map((row) => ({
    ...row,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
  }));
}
