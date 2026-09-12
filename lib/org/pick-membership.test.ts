import { describe, expect, it } from "vitest";
import { pickCurrentMembership } from "@/lib/org/pick-membership";

interface Fake {
  organizationId: string;
  label: string;
}

const orgA: Fake = { organizationId: "org-a", label: "A" };
const orgB: Fake = { organizationId: "org-b", label: "B" };

describe("pickCurrentMembership", () => {
  it("returns null for a user with no memberships", () => {
    expect(pickCurrentMembership([], "org-a")).toBeNull();
  });

  it("defaults to the first membership when there is no preferred org", () => {
    expect(pickCurrentMembership([orgA, orgB], undefined)).toBe(orgA);
  });

  it("picks the membership matching the preferred org, even when it isn't first", () => {
    expect(pickCurrentMembership([orgA, orgB], "org-b")).toBe(orgB);
  });

  it("falls back to the first membership when the preferred org isn't one of this user's own", () => {
    // Simulates a stale cookie naming an org the user was removed from, or
    // one belonging to a different account entirely — must never throw or
    // reach outside this user's own membership list.
    expect(pickCurrentMembership([orgA, orgB], "org-someone-elses")).toBe(orgA);
  });

  it("returns the only membership regardless of the preferred org", () => {
    expect(pickCurrentMembership([orgA], "org-b")).toBe(orgA);
  });
});
