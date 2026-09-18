import { getScopedDb, type ScopedDb } from "@/lib/db/scopedClient";
import { logError } from "@/lib/db/errors";
import { auditLog } from "@/drizzle/schema";

export type AuditAction = "create" | "update" | "delete";
export type AuditEntity = "staff" | "shift_type" | "shift_assignment";

/**
 * Records one 変更履歴 (audit log) row. Deliberately swallows its own
 * failures (logging via lib/db/errors.ts's logError instead of throwing) —
 * a manager creating a staff member should never see "保存に失敗しました"
 * because the audit trail itself couldn't be written; that would make a
 * secondary feature take down a primary one.
 */
export async function recordAuditLog(
  organizationId: string,
  actorId: string | null,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string | null,
  diff?: Record<string, unknown>,
): Promise<void> {
  try {
    const { db } = getScopedDb(organizationId);
    await db.insert(auditLog).values({
      organizationId,
      actorId,
      action,
      entity,
      entityId,
      diff: diff ?? null,
    });
  } catch (err) {
    logError(err);
  }
}

/**
 * Builds the auditLog insert as a plain statement (not yet awaited) for
 * callers that want to fold it into their own db.batch() — e.g.
 * lib/shifts/assign.ts's setShiftAssignment, which already writes 2-3
 * statements atomically and shouldn't pay a whole extra round-trip just to
 * log the same change. Errors here surface through that batch's own
 * try/catch, same as every other statement in it — unlike recordAuditLog(),
 * a failure here is not swallowed, since by construction it's batched
 * together with the write it's describing (if the batch fails, so should
 * this, whichever statement is technically at fault).
 */
export function auditLogInsertStatement(
  db: ScopedDb["db"],
  organizationId: string,
  actorId: string | null,
  action: AuditAction,
  entity: AuditEntity,
  entityId: string | null,
  diff?: Record<string, unknown>,
) {
  return db.insert(auditLog).values({
    organizationId,
    actorId,
    action,
    entity,
    entityId,
    diff: diff ?? null,
  });
}
