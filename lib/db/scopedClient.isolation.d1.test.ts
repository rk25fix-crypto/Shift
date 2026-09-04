import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getRawDb } from "@/lib/db/raw";
import { getScopedDb } from "@/lib/db/scopedClient";
import { organizations, staff, staffCompensation, shiftTypes, subscriptions } from "@/drizzle/schema";
import { listStaff, getStaff, getStaffHourlyWage } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForDate } from "@/lib/shifts/queries";
import { shiftAssignments } from "@/drizzle/schema";

/**
 * The real backstop for tenant isolation now that D1 has no Row-Level
 * Security (docs/plan.md "テナント分離モデル(D1版)"). This must keep
 * passing every time a table or query function is added — a missed
 * organization_id filter here is a cross-tenant data leak in production,
 * not just a failing test.
 */

let orgA: { id: string };
let orgB: { id: string };
let staffA: { id: string };
let staffB: { id: string };
let shiftTypeA: { id: string };

beforeAll(async () => {
  const db = getRawDb();

  [orgA] = await db.insert(organizations).values({ name: "事業所A" }).returning({ id: organizations.id });
  [orgB] = await db.insert(organizations).values({ name: "事業所B" }).returning({ id: organizations.id });

  [staffA] = await db
    .insert(staff)
    .values({ organizationId: orgA.id, name: "スタッフA" })
    .returning({ id: staff.id });
  [staffB] = await db
    .insert(staff)
    .values({ organizationId: orgB.id, name: "スタッフB" })
    .returning({ id: staff.id });

  await db.insert(staffCompensation).values({
    organizationId: orgA.id,
    staffId: staffA.id,
    hourlyWage: 1200,
  });
  await db.insert(staffCompensation).values({
    organizationId: orgB.id,
    staffId: staffB.id,
    hourlyWage: 1500,
  });

  [shiftTypeA] = await db
    .insert(shiftTypes)
    .values({
      organizationId: orgA.id,
      code: "早1",
      name: "早番",
      startTime: "07:00",
      endTime: "16:00",
      isRequired: true,
    })
    .returning({ id: shiftTypes.id });

  await db.insert(shiftAssignments).values({
    organizationId: orgA.id,
    staffId: staffA.id,
    shiftTypeId: shiftTypeA.id,
    date: "2026-06-01",
  });

  await db.insert(subscriptions).values({ organizationId: orgA.id, plan: "trial" });
  await db.insert(subscriptions).values({ organizationId: orgB.id, plan: "pro" });
});

describe("staff isolation", () => {
  it("listStaff never returns another org's staff", async () => {
    const result = await listStaff(orgA.id);
    expect(result.map((s) => s.id)).toEqual([staffA.id]);
    expect(result.map((s) => s.id)).not.toContain(staffB.id);
  });

  it("getStaff returns null when staffId belongs to a different org", async () => {
    expect(await getStaff(orgA.id, staffB.id)).toBeNull();
    expect(await getStaff(orgB.id, staffA.id)).toBeNull();
  });

  it("getStaff returns the record for the correct org", async () => {
    const result = await getStaff(orgA.id, staffA.id);
    expect(result?.id).toBe(staffA.id);
  });
});

describe("staff_compensation isolation (column-level, RLS-equivalent)", () => {
  it("owner can read their own org's staff wage", async () => {
    expect(await getStaffHourlyWage(orgA.id, staffA.id, "owner")).toBe(1200);
  });

  it("staff role can never read a wage, even their own org's", async () => {
    expect(await getStaffHourlyWage(orgA.id, staffA.id, "staff")).toBeNull();
    expect(await getStaffHourlyWage(orgA.id, staffA.id, "admin")).toBeNull();
  });

  it("owner of org A cannot read org B's staff wage via a mismatched call", async () => {
    // staffB belongs to orgB — calling with orgA's id must not leak it.
    expect(await getStaffHourlyWage(orgA.id, staffB.id, "owner")).toBeNull();
  });
});

describe("shift_types isolation", () => {
  it("listShiftTypes never returns another org's shift types", async () => {
    const result = await listShiftTypes(orgA.id);
    expect(result.map((t) => t.id)).toEqual([shiftTypeA.id]);

    const emptyForOrgB = await listShiftTypes(orgB.id);
    expect(emptyForOrgB).toEqual([]);
  });
});

describe("shift_assignments isolation", () => {
  it("getAssignmentsForDate never returns another org's assignments", async () => {
    const resultA = await getAssignmentsForDate(orgA.id, "2026-06-01");
    expect(resultA).toHaveLength(1);
    expect(resultA[0].staffId).toBe(staffA.id);

    const resultB = await getAssignmentsForDate(orgB.id, "2026-06-01");
    expect(resultB).toHaveLength(0);
  });
});

describe("subscriptions isolation (generic scoped-query pattern)", () => {
  it("a scoped query for one org never returns another org's subscription row", async () => {
    const { db } = getScopedDb(orgA.id);
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgA.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].plan).toBe("trial");
    expect(rows.some((r) => r.organizationId === orgB.id)).toBe(false);
  });
});
