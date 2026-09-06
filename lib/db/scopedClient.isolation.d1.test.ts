import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getRawDb } from "@/lib/db/raw";
import { getScopedDb } from "@/lib/db/scopedClient";
import { organizations, staff, staffCompensation, shiftTypes, subscriptions } from "@/drizzle/schema";
import { listStaff, getStaff, getStaffHourlyWage } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { getAssignmentsForDate, getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import { setShiftAssignment } from "@/lib/shifts/assign";
import { listTimeOffForRange } from "@/lib/time-off/queries";
import { setTimeOffRequest } from "@/lib/time-off/set";
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
let shiftTypeB: { id: string };

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

  [shiftTypeB] = await db
    .insert(shiftTypes)
    .values({
      organizationId: orgB.id,
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
    const resultA = await listShiftTypes(orgA.id);
    expect(resultA.map((t) => t.id)).toEqual([shiftTypeA.id]);

    const resultB = await listShiftTypes(orgB.id);
    expect(resultB.map((t) => t.id)).toEqual([shiftTypeB.id]);
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

  it("getAssignmentsForOrgRange never returns another org's assignments", async () => {
    const resultA = await getAssignmentsForOrgRange(orgA.id, "2026-05-30", "2026-06-06");
    expect(resultA).toHaveLength(1);
    expect(resultA[0].staffId).toBe(staffA.id);

    const resultB = await getAssignmentsForOrgRange(orgB.id, "2026-05-30", "2026-06-06");
    expect(resultB).toHaveLength(0);
  });
});

describe("setShiftAssignment isolation (write path)", () => {
  it("rejects another org's staffId instead of writing a cross-tenant row", async () => {
    const result = await setShiftAssignment(orgA.id, null, staffB.id, "2026-06-15", shiftTypeA.id);
    expect(result.error).toBe("スタッフが見つかりません");

    const rows = await getAssignmentsForDate(orgA.id, "2026-06-15");
    expect(rows).toHaveLength(0);
  });

  it("rejects another org's shiftTypeId instead of writing a cross-tenant row", async () => {
    const result = await setShiftAssignment(orgA.id, null, staffA.id, "2026-06-16", shiftTypeB.id);
    expect(result.error).toBe("シフト種別が見つかりません");

    const rows = await getAssignmentsForDate(orgA.id, "2026-06-16");
    expect(rows).toHaveLength(0);
  });

  it("accepts the caller's own org's staffId and shiftTypeId", async () => {
    const result = await setShiftAssignment(orgA.id, null, staffA.id, "2026-06-17", shiftTypeA.id);
    expect(result.error).toBeNull();

    const rows = await getAssignmentsForDate(orgA.id, "2026-06-17");
    expect(rows).toHaveLength(1);
    expect(rows[0].staffId).toBe(staffA.id);
  });
});

describe("time_off_requests isolation", () => {
  it("listTimeOffForRange never returns another org's time-off requests", async () => {
    await setTimeOffRequest(orgA.id, staffA.id, "2026-06-20");

    const resultA = await listTimeOffForRange(orgA.id, "2026-06-18", "2026-06-22");
    expect(resultA).toEqual([{ staffId: staffA.id, date: "2026-06-20" }]);

    const resultB = await listTimeOffForRange(orgB.id, "2026-06-18", "2026-06-22");
    expect(resultB).toHaveLength(0);
  });

  it("setTimeOffRequest rejects another org's staffId instead of writing a cross-tenant row", async () => {
    const result = await setTimeOffRequest(orgA.id, staffB.id, "2026-06-21");
    expect(result.error).toBe("スタッフが見つかりません");

    const rowsA = await listTimeOffForRange(orgA.id, "2026-06-21", "2026-06-22");
    expect(rowsA).toHaveLength(0);
    const rowsB = await listTimeOffForRange(orgB.id, "2026-06-21", "2026-06-22");
    expect(rowsB).toHaveLength(0);
  });

  it("clears an existing shift assignment when a day off is requested for the same date", async () => {
    await setShiftAssignment(orgA.id, null, staffA.id, "2026-06-22", shiftTypeA.id);
    await setTimeOffRequest(orgA.id, staffA.id, "2026-06-22");

    const assignments = await getAssignmentsForDate(orgA.id, "2026-06-22");
    expect(assignments).toHaveLength(0);
    const timeOff = await listTimeOffForRange(orgA.id, "2026-06-22", "2026-06-23");
    expect(timeOff).toEqual([{ staffId: staffA.id, date: "2026-06-22" }]);
  });

  it("clears an existing time-off request when a shift is assigned for the same date", async () => {
    await setTimeOffRequest(orgA.id, staffA.id, "2026-06-23");
    await setShiftAssignment(orgA.id, null, staffA.id, "2026-06-23", shiftTypeA.id);

    const timeOff = await listTimeOffForRange(orgA.id, "2026-06-23", "2026-06-24");
    expect(timeOff).toHaveLength(0);
    const assignments = await getAssignmentsForDate(orgA.id, "2026-06-23");
    expect(assignments).toHaveLength(1);
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
