/**
 * Converts a caught D1/Drizzle error into a message safe to show a user.
 * D1's driver errors include the raw failed SQL statement and every bound
 * parameter value (table/column names, org/staff IDs, ...) in `err.message`
 * — returning that straight to the client is an information leak, and it's
 * also just confusing to a non-technical manager. The real error is always
 * logged server-side (visible via `wrangler tail`/the dashboard) so nothing
 * is lost for debugging; only a generic or caller-supplied friendly message
 * ever reaches the response.
 *
 * `onUniqueConstraint` covers the one class of DB error that's often a
 * legitimate, explainable user mistake rather than a bug — a UNIQUE
 * constraint violation (e.g. reusing a shift-type code already taken in
 * this org) — and is otherwise omitted so callers with no such scenario
 * don't need to think about it.
 */
export function toUserFacingError(
  err: unknown,
  fallbackMessage: string,
  options?: { onUniqueConstraint?: string },
): string {
  logError(err);

  if (options?.onUniqueConstraint && errorChainMatches(err, /UNIQUE constraint failed/i)) {
    return options.onUniqueConstraint;
  }

  return fallbackMessage;
}

/**
 * True if any message in `err`'s cause chain matches `pattern`. Drizzle's D1
 * driver throws a wrapper error whose own `.message` is generic ("Failed
 * query: <sql>\nparams: <values>") — the actual SQLite reason (e.g. "UNIQUE
 * constraint failed: ..." or "FOREIGN KEY constraint failed") only shows up
 * on `err.cause`, and D1 itself adds another layer on top of that, so code
 * that needs to recognize a *specific* kind of failure (not just "it
 * failed") has to check the whole chain, not just the top-level message —
 * checking only `err.message` silently never matches anything.
 */
export function errorChainMatches(err: unknown, pattern: RegExp): boolean {
  return causeChainMessages(err).some((message) => pattern.test(message));
}

/**
 * Logs an error for our own debugging (wrangler tail/dashboard), explicitly
 * including every message in the `.cause` chain. Node's console.error
 * normally walks `.cause` on its own when printing an Error, but that isn't
 * guaranteed for every runtime this app can end up deployed to (Cloudflare
 * Workers' `workerd`) — and the useful SQLite reason lives two `.cause`
 * levels down (see errorChainMatches's docstring), so silently losing it
 * here would defeat the whole point of logging server-side before
 * discarding the raw message from the client-facing response.
 */
export function logError(err: unknown): void {
  console.error(err);
  const chain = causeChainMessages(err);
  if (chain.length > 1) console.error("cause chain:", chain);
}

function causeChainMessages(err: unknown, maxDepth = 5): string[] {
  const messages: string[] = [];
  let current: unknown = err;
  let depth = 0;
  while (current instanceof Error && depth < maxDepth) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
    depth++;
  }
  return messages;
}
