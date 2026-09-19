import { describe, expect, it, vi } from "vitest";
import { errorChainMatches, toUserFacingError } from "@/lib/db/errors";

/**
 * Mirrors what D1/drizzle actually throw (confirmed empirically against a
 * real local D1 instance): the outer error's own `.message` is a generic
 * "Failed query: <sql>\nparams: <values>" — the useful SQLite reason only
 * shows up nested under `.cause`, sometimes two levels deep.
 */
function d1StyleError(sqlMessage: string, reason: string): Error {
  return new Error(sqlMessage, {
    cause: new Error(`D1_ERROR: ${reason}`, { cause: new Error(reason) }),
  });
}

describe("errorChainMatches", () => {
  it("finds a pattern nested two levels down in the cause chain", () => {
    const err = d1StyleError(
      'Failed query: insert into "shift_types" (...) values (...)',
      "UNIQUE constraint failed: shift_types.organization_id, shift_types.code",
    );
    expect(errorChainMatches(err, /UNIQUE constraint failed/i)).toBe(true);
  });

  it("does not match a pattern that isn't present anywhere in the chain", () => {
    const err = d1StyleError("Failed query: ...", "some other SQLite error");
    expect(errorChainMatches(err, /UNIQUE constraint failed/i)).toBe(false);
  });

  it("does not match against a non-Error value", () => {
    expect(errorChainMatches("just a string", /UNIQUE constraint failed/i)).toBe(false);
  });
});

describe("toUserFacingError", () => {
  it("never returns the raw driver error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = d1StyleError(
      'Failed query: insert into "shift_types" (...) values (...) params: org-a-id,早1,...',
      "some internal reason",
    );
    const result = toUserFacingError(err, "保存に失敗しました");
    expect(result).toBe("保存に失敗しました");
    expect(result).not.toContain("shift_types");
    expect(result).not.toContain("org-a-id");
  });

  it("logs the real error server-side for debugging", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    toUserFacingError(err, "保存に失敗しました");
    expect(spy).toHaveBeenCalledWith(err);
  });

  it("also logs every message in the cause chain, not just the top-level error", () => {
    // console.error(err) alone doesn't reliably surface a deeply-nested
    // .cause on every runtime this app deploys to (Cloudflare's workerd),
    // and the useful SQLite reason lives two .cause levels down — losing it
    // here would defeat the point of logging server-side before discarding
    // the raw message from the response.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = d1StyleError(
      'Failed query: insert into "shift_types" (...) values (...)',
      "UNIQUE constraint failed: shift_types.organization_id, shift_types.code",
    );
    toUserFacingError(err, "保存に失敗しました");
    expect(spy).toHaveBeenCalledWith("cause chain:", [
      err.message,
      (err.cause as Error).message,
      ((err.cause as Error).cause as Error).message,
    ]);
  });

  it("returns the caller-supplied message for a UNIQUE constraint violation nested under .cause", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = d1StyleError(
      'Failed query: insert into "shift_types" (...) values (...)',
      "UNIQUE constraint failed: shift_types.organization_id, shift_types.code",
    );
    const result = toUserFacingError(err, "保存に失敗しました", {
      onUniqueConstraint: "このコードは既に使われています",
    });
    expect(result).toBe("このコードは既に使われています");
  });

  it("falls back to the generic message for a UNIQUE violation when no override is given", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = d1StyleError("Failed query: ...", "UNIQUE constraint failed: staff.id");
    expect(toUserFacingError(err, "保存に失敗しました")).toBe("保存に失敗しました");
  });

  it("falls back to the generic message for a non-Error throw", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toUserFacingError("not an Error object", "保存に失敗しました")).toBe(
      "保存に失敗しました",
    );
  });
});
