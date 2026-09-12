/**
 * Picks "current" out of a user's memberships: the one matching
 * `preferredOrgId` (the CURRENT_ORG_COOKIE value, see lib/org/current.ts) if
 * it's actually one of theirs, otherwise the first membership (stable —
 * callers pass rows ordered by creation so this is deterministic across
 * calls). A stale cookie naming an org this user no longer belongs to (or
 * never did) simply fails to match and falls through to the default — it
 * can never select another user's membership, since `memberships` is
 * always pre-filtered to the current session's userId before this ever runs.
 *
 * Kept in its own file, with no D1/session imports, purely so it can be
 * unit-tested under plain vitest.config.ts — lib/org/current.ts (where this
 * used to live) imports lib/db/raw.ts, which imports `cloudflare:workers`
 * and only resolves inside a real Workers/Miniflare runtime, same reasoning
 * as e.g. lib/labor-rules.ts vs. lib/shifts/worked-shift.ts.
 */
export function pickCurrentMembership<T extends { organizationId: string }>(
  memberships: T[],
  preferredOrgId: string | undefined,
): T | null {
  if (memberships.length === 0) return null;
  if (preferredOrgId) {
    const match = memberships.find((m) => m.organizationId === preferredOrgId);
    if (match) return match;
  }
  return memberships[0];
}
