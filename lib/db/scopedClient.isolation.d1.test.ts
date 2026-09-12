import { and, eq, gte, lt } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getRawDb } from "@/lib/db/raw";
import { getScopedDb } from "@/lib/db/scopedClient";
import { organizations, staff, staffCompensation, shiftTypes, subscriptions } from "@/drizzle/schema";
import { listStaff, getStaff, getStaffHourlyWage } from "@/lib/staff/queries";
import { createStaffCore, deactivateStaffCore, updateStaffCore } from "@/lib/staff/write";
import { listShiftTypes, getShiftType } from "@/lib/shift-types/queries";
import { createShiftTypeCore, deleteShiftTypeCore, updateShiftTypeCore } from "@/lib/shift-types/write";
import {
  getAssignmentsForDate,
  getAssignmentsForOrgMonth,
  getAssignmentsForOrgRange,
} from "@/lib/shifts/queries";
import { setShiftAssignment } from "@/lib/shifts/assign";
import { confirmDraftShifts, discardDraftShifts, generateDraftShifts } from "@/lib/shifts/generate";
import { listTimeOffForRange } from "@/lib/time-off/queries";
import { setTimeOffRequest } from "@/lib/time-off/set";
import { getWorkRuleSettings } from "@/lib/org/queries";
import { getLaborWarnings } from "@/lib/shifts/labor-warnings";
import { getStaffPayrollEstimate } from "@/lib/shifts/payroll";
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

describe("createStaffCore/updateStaffCore/deactivateStaffCore isolation (write path)", () => {
  const baseInput = {
    name: "新規スタッフ",
    roleLabel: "",
    fixedDaysOff: [],
    unavailableShiftTypeIds: [],
    hourlyWage: null as number | null,
  };

  it("createStaffCore only ever writes into the calling org", async () => {
    const result = await createStaffCore(orgA.id, "owner", { ...baseInput, name: "作成テスト" });
    expect(result.error).toBeNull();

    const listA = await listStaff(orgA.id);
    const created = listA.find((s) => s.name === "作成テスト");
    expect(created).toBeDefined();

    const listB = await listStaff(orgB.id);
    expect(listB.some((s) => s.name === "作成テスト")).toBe(false);

    const db = getRawDb();
    await db.delete(staff).where(eq(staff.id, created!.id));
  });

  it("createStaffCore writes staff_compensation only when the caller's role is owner", async () => {
    const owned = await createStaffCore(orgA.id, "owner", {
      ...baseInput,
      name: "時給テストowner",
      hourlyWage: 999,
    });
    expect(owned.error).toBeNull();
    const ownerStaff = (await listStaff(orgA.id)).find((s) => s.name === "時給テストowner")!;
    expect(await getStaffHourlyWage(orgA.id, ownerStaff.id, "owner")).toBe(999);

    const asAdmin = await createStaffCore(orgA.id, "admin", {
      ...baseInput,
      name: "時給テストadmin",
      hourlyWage: 999,
    });
    expect(asAdmin.error).toBeNull();
    const adminStaff = (await listStaff(orgA.id)).find((s) => s.name === "時給テストadmin")!;
    expect(await getStaffHourlyWage(orgA.id, adminStaff.id, "owner")).toBeNull();

    const db = getRawDb();
    await db.delete(staff).where(eq(staff.id, ownerStaff.id));
    await db.delete(staff).where(eq(staff.id, adminStaff.id));
  });

  it("updateStaffCore rejects a mismatched staffId instead of silently overwriting another org's wage", async () => {
    // Regression test: staffCompensation.staffId is unique with no
    // organizationId guard of its own, so before updateStaffCore resolved
    // staffId against organizationId first, this call would have silently
    // overwritten org B's wage row (or inserted an orphan one for orgA) via
    // its onConflictDoUpdate — the staff-row UPDATE's own WHERE clause
    // matching zero rows was not enough to stop it.
    const before = await getStaff(orgB.id, staffB.id);
    expect(before).not.toBeNull();

    const updateResult = await updateStaffCore(orgA.id, "owner", staffB.id, {
      ...baseInput,
      name: "乗っ取りテスト",
      hourlyWage: 1,
    });
    expect(updateResult.error).toBe("スタッフが見つかりません");

    const after = await getStaff(orgB.id, staffB.id);
    expect(after).toEqual(before);
    expect(await getStaffHourlyWage(orgB.id, staffB.id, "owner")).toBe(1500);
  });

  it("deactivateStaffCore never mutates another org's staff row when passed a mismatched staffId", async () => {
    // Scoped with orgA.id but targets staffB (org B's row) — the org-scoped
    // WHERE clause must match zero rows, not staffB's.
    const before = await getStaff(orgB.id, staffB.id);
    expect(before).not.toBeNull();

    const deactivateResult = await deactivateStaffCore(orgA.id, staffB.id);
    expect(deactivateResult.error).toBeNull();

    const after = await getStaff(orgB.id, staffB.id);
    expect(after).toEqual(before);
  });

  it("updateStaffCore/deactivateStaffCore mutate the caller's own org's staff row", async () => {
    const created = await createStaffCore(orgA.id, "owner", { ...baseInput, name: "更新前" });
    expect(created.error).toBeNull();
    const row = (await listStaff(orgA.id)).find((s) => s.name === "更新前")!;

    const updateResult = await updateStaffCore(orgA.id, "owner", row.id, {
      ...baseInput,
      name: "更新後",
    });
    expect(updateResult.error).toBeNull();
    expect((await getStaff(orgA.id, row.id))?.name).toBe("更新後");

    const deactivateResult = await deactivateStaffCore(orgA.id, row.id);
    expect(deactivateResult.error).toBeNull();
    expect((await getStaff(orgA.id, row.id))?.isActive).toBe(false);

    const db = getRawDb();
    await db.delete(staff).where(eq(staff.id, row.id));
  });
});

describe("shift_types isolation", () => {
  it("listShiftTypes never returns another org's shift types", async () => {
    const resultA = await listShiftTypes(orgA.id);
    expect(resultA.map((t) => t.id)).toEqual([shiftTypeA.id]);

    const resultB = await listShiftTypes(orgB.id);
    expect(resultB.map((t) => t.id)).toEqual([shiftTypeB.id]);
  });

  it("getShiftType returns null when shiftTypeId belongs to a different org", async () => {
    expect(await getShiftType(orgA.id, shiftTypeB.id)).toBeNull();
    expect(await getShiftType(orgB.id, shiftTypeA.id)).toBeNull();
  });

  it("getShiftType returns the record for the correct org", async () => {
    const result = await getShiftType(orgA.id, shiftTypeA.id);
    expect(result?.id).toBe(shiftTypeA.id);
  });
});

describe("createShiftTypeCore/updateShiftTypeCore/deleteShiftTypeCore isolation (write path)", () => {
  const baseInput = {
    code: "テ1",
    name: "テスト番",
    startTime: "09:00",
    endTime: "18:00",
    crossesMidnight: false,
    breakMinutes: 60,
    isRequired: false,
    isBalanced: true,
    requiredCount: 1,
    colorKey: null,
    sortOrder: 0,
  };

  it("deleteShiftTypeCore reports an in-use shift type with the friendly message, against a real FK violation", async () => {
    // Regression test: the FK-in-use check used to test err.message only,
    // but D1/Drizzle nest the real SQLite reason under err.cause (see
    // lib/db/errors.ts) — err.message is always the generic "Failed query:
    // ..." string, so the old check never actually matched and this always
    // fell through to leaking the raw driver error instead. shiftTypeA is
    // referenced by the confirmed shift_assignments row this file's
    // beforeAll fixture inserts on 2026-06-01, so this exercises a real FK
    // constraint failure, not a synthetic one.
    const result = await deleteShiftTypeCore(orgA.id, shiftTypeA.id);
    expect(result.error).toBe("このシフト種別は使用中のため削除できません");

    // Never actually deleted — later tests in this file still depend on it.
    expect(await getShiftType(orgA.id, shiftTypeA.id)).not.toBeNull();
  });

  it("createShiftTypeCore only ever writes into the calling org", async () => {
    const result = await createShiftTypeCore(orgA.id, { ...baseInput, code: "作成テ" });
    expect(result.error).toBeNull();

    const listA = await listShiftTypes(orgA.id);
    const created = listA.find((t) => t.code === "作成テ");
    expect(created).toBeDefined();

    const listB = await listShiftTypes(orgB.id);
    expect(listB.some((t) => t.code === "作成テ")).toBe(false);

    const db = getRawDb();
    await db.delete(shiftTypes).where(eq(shiftTypes.id, created!.id));
  });

  it("updateShiftTypeCore/deleteShiftTypeCore never mutate another org's shift type when passed a mismatched id", async () => {
    // Both calls are scoped with orgA.id but target shiftTypeB (org B's row)
    // — the org-scoped WHERE clause must match zero rows, not shiftTypeB's.
    const before = await getShiftType(orgB.id, shiftTypeB.id);
    expect(before).not.toBeNull();

    const updateResult = await updateShiftTypeCore(orgA.id, shiftTypeB.id, {
      ...baseInput,
      code: "乗っ取り",
    });
    expect(updateResult.error).toBeNull();

    const deleteResult = await deleteShiftTypeCore(orgA.id, shiftTypeB.id);
    expect(deleteResult.error).toBeNull();

    const after = await getShiftType(orgB.id, shiftTypeB.id);
    expect(after).toEqual(before);
  });

  it("updateShiftTypeCore updates the caller's own org's shift type", async () => {
    const created = await createShiftTypeCore(orgA.id, { ...baseInput, code: "更新前テ" });
    expect(created.error).toBeNull();
    const row = (await listShiftTypes(orgA.id)).find((t) => t.code === "更新前テ")!;

    const result = await updateShiftTypeCore(orgA.id, row.id, { ...baseInput, code: "更新後テ" });
    expect(result.error).toBeNull();

    const updated = await getShiftType(orgA.id, row.id);
    expect(updated?.code).toBe("更新後テ");

    const cleanupResult = await deleteShiftTypeCore(orgA.id, row.id);
    expect(cleanupResult.error).toBeNull();
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

  it("getAssignmentsForOrgMonth never returns another org's assignments", async () => {
    const resultA = await getAssignmentsForOrgMonth(orgA.id, "2026-06");
    expect(resultA.some((a) => a.date === "2026-06-01" && a.staffId === staffA.id)).toBe(true);

    const resultB = await getAssignmentsForOrgMonth(orgB.id, "2026-06");
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

  it("re-assigning the identical shift type to the same staff+date leaves exactly one row", async () => {
    // Regression test for the clear+insert batching change: the clear
    // (delete) and the insert now run in the SAME db.batch() call rather
    // than as two separate round-trips. D1 executes a batch's statements
    // in array order within one implicit transaction, so the delete still
    // removes the existing (staffId, date, shiftTypeId) row before the
    // insert runs — even when the new row is identical to the one being
    // cleared, this must not violate the unique constraint or leave zero
    // rows behind.
    const first = await setShiftAssignment(orgA.id, null, staffA.id, "2026-06-19", shiftTypeA.id);
    expect(first.error).toBeNull();

    const second = await setShiftAssignment(orgA.id, null, staffA.id, "2026-06-19", shiftTypeA.id);
    expect(second.error).toBeNull();

    const rows = await getAssignmentsForDate(orgA.id, "2026-06-19");
    expect(rows).toHaveLength(1);
    expect(rows[0].shiftTypeId).toBe(shiftTypeA.id);
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

describe("generateDraftShifts/confirmDraftShifts/discardDraftShifts isolation (write path)", () => {
  const RANGE_START = "2026-07-06"; // a Monday, unused by any other test's fixture data
  const RANGE_END = "2026-07-13";

  it("generateDraftShifts only writes drafts for the calling org", async () => {
    const before = await getAssignmentsForOrgRange(orgB.id, RANGE_START, RANGE_END, {
      includeDrafts: true,
    });
    expect(before).toHaveLength(0);

    const result = await generateDraftShifts(orgA.id, RANGE_START, RANGE_END);
    expect(result.error).toBeNull();
    expect(result.draftCount).toBe(7); // one per day, staffA is eligible every day

    const draftsA = await getAssignmentsForOrgRange(orgA.id, RANGE_START, RANGE_END, {
      includeDrafts: true,
    });
    expect(draftsA).toHaveLength(7);
    expect(draftsA.every((a) => a.status === "draft" && a.staffId === staffA.id)).toBe(true);

    const stillNoneForB = await getAssignmentsForOrgRange(orgB.id, RANGE_START, RANGE_END, {
      includeDrafts: true,
    });
    expect(stillNoneForB).toHaveLength(0);
  });

  it("confirmDraftShifts only confirms the calling org's drafts in range", async () => {
    await generateDraftShifts(orgB.id, RANGE_START, RANGE_END);

    const result = await confirmDraftShifts(orgA.id, RANGE_START, RANGE_END);
    expect(result.error).toBeNull();

    const orgAAssignments = await getAssignmentsForOrgRange(orgA.id, RANGE_START, RANGE_END, {
      includeDrafts: true,
    });
    expect(orgAAssignments.every((a) => a.status === "confirmed")).toBe(true);

    const orgBAssignments = await getAssignmentsForOrgRange(orgB.id, RANGE_START, RANGE_END, {
      includeDrafts: true,
    });
    expect(orgBAssignments.length).toBeGreaterThan(0);
    expect(orgBAssignments.every((a) => a.status === "draft")).toBe(true);
  });

  it("discardDraftShifts only discards the calling org's drafts in range", async () => {
    // orgA's assignments in this range are confirmed (previous test) — discard must not touch them.
    const result = await discardDraftShifts(orgB.id, RANGE_START, RANGE_END);
    expect(result.error).toBeNull();

    const orgBAssignments = await getAssignmentsForOrgRange(orgB.id, RANGE_START, RANGE_END, {
      includeDrafts: true,
    });
    expect(orgBAssignments).toHaveLength(0);

    const orgAAssignments = await getAssignmentsForOrgRange(orgA.id, RANGE_START, RANGE_END, {
      includeDrafts: true,
    });
    expect(orgAAssignments).toHaveLength(7);
    expect(orgAAssignments.every((a) => a.status === "confirmed")).toBe(true);
  });

  it("inserts more than 16 drafts in one call without hitting D1's bound-parameter limit", async () => {
    // Regression test for a real bug: drizzle binds every column per row
    // (including `id` and the `status` literal, not just the "obvious"
    // values), so a naive chunk size based on a wrong per-row param count
    // silently exceeded D1's 100-bound-parameter ceiling once a single
    // generate() call produced more than ~16 rows.
    //
    // orgA already has shiftTypeA (isRequired, requiredCount 1) from this
    // file's shared fixtures, so it competes for the same staff pool as the
    // new type below — 3 extra staff (4 total with staffA) exactly covers
    // shiftTypeA's 1/day + this type's 3/day, giving 7*(1+3) = 28 rows with
    // nothing left unfilled.
    const db = getRawDb();
    const extraStaff = await db
      .insert(staff)
      .values([
        { organizationId: orgA.id, name: "スタッフC" },
        { organizationId: orgA.id, name: "スタッフD" },
        { organizationId: orgA.id, name: "スタッフE" },
      ])
      .returning({ id: staff.id });

    const [manyRequiredType] = await db
      .insert(shiftTypes)
      .values({
        organizationId: orgA.id,
        code: "遅1",
        name: "遅番",
        startTime: "13:00",
        endTime: "22:00",
        isRequired: true,
        requiredCount: 3,
      })
      .returning({ id: shiftTypes.id });

    const start = "2026-08-03"; // a Monday, unused by any other test's fixture data
    const end = "2026-08-10";

    const result = await generateDraftShifts(orgA.id, start, end);
    expect(result.error).toBeNull();
    expect(result.draftCount).toBe(28); // (1 + 3) required per day x 7 days
    expect(result.unfilledShifts).toHaveLength(0);

    const drafts = await getAssignmentsForOrgRange(orgA.id, start, end, { includeDrafts: true });
    expect(drafts).toHaveLength(28);
    expect(drafts.every((a) => a.status === "draft")).toBe(true);
    expect(drafts.filter((a) => a.shiftTypeId === manyRequiredType.id)).toHaveLength(21);

    // Cleanup so this fixture doesn't affect any other test in the file
    // (e.g. staff/shift-type listing counts) run after this one.
    await discardDraftShifts(orgA.id, start, end);
    await db.delete(shiftTypes).where(eq(shiftTypes.id, manyRequiredType.id));
    for (const s of extraStaff) {
      await db.delete(staff).where(eq(staff.id, s.id));
    }
  });

  it("generates a full calendar month in one db.batch() call without hitting a D1 statement-count ceiling", async () => {
    // Task #50 (monthly auto-generation) turns one generateDraftShifts call
    // into a much bigger db.batch() than any week-scoped call ever produced
    // — Cloudflare's docs don't publish a batch statement-count limit (only
    // the 100-bound-parameter-per-statement one INSERT_CHUNK_SIZE already
    // accounts for), so this is the empirical check that a real 31-day
    // month's worth of chunks still commits in one batch against real D1.
    const db = getRawDb();
    const extraStaff = await db
      .insert(staff)
      .values([
        { organizationId: orgA.id, name: "スタッフF" },
        { organizationId: orgA.id, name: "スタッフG" },
        { organizationId: orgA.id, name: "スタッフH" },
      ])
      .returning({ id: staff.id });

    const [monthType] = await db
      .insert(shiftTypes)
      .values({
        organizationId: orgA.id,
        code: "月1",
        name: "月次テスト用",
        startTime: "09:00",
        endTime: "17:00",
        isRequired: true,
        requiredCount: 3,
      })
      .returning({ id: shiftTypes.id });

    const start = "2026-09-01";
    const end = "2026-10-01"; // 30 days in September

    const result = await generateDraftShifts(orgA.id, start, end);
    expect(result.error).toBeNull();
    // (1 from shiftTypeA + 3 from monthType) * 30 days = 120 rows, chunked
    // at 12/insert => 10 insert statements + 1 delete = 11 in one batch().
    expect(result.draftCount).toBe(120);
    expect(result.unfilledShifts).toHaveLength(0);

    const drafts = await getAssignmentsForOrgRange(orgA.id, start, end, { includeDrafts: true });
    expect(drafts).toHaveLength(120);
    expect(drafts.every((a) => a.status === "draft")).toBe(true);

    // Cleanup so this fixture doesn't affect any other test in the file.
    await discardDraftShifts(orgA.id, start, end);
    await db.delete(shiftTypes).where(eq(shiftTypes.id, monthType.id));
    for (const s of extraStaff) {
      await db.delete(staff).where(eq(staff.id, s.id));
    }
  });
});

describe("getWorkRuleSettings isolation", () => {
  it("returns each org's own thresholds, not another org's", async () => {
    const db = getRawDb();
    // Both orgs use the schema default (6) at this point — give orgA a
    // distinct value so a mix-up would actually be visible.
    await db
      .update(organizations)
      .set({ maxConsecutiveDays: 3 })
      .where(eq(organizations.id, orgA.id));

    try {
      const settingsA = await getWorkRuleSettings(orgA.id);
      expect(settingsA.maxConsecutiveDays).toBe(3);

      const settingsB = await getWorkRuleSettings(orgB.id);
      expect(settingsB.maxConsecutiveDays).toBe(6);
    } finally {
      await db
        .update(organizations)
        .set({ maxConsecutiveDays: 6 })
        .where(eq(organizations.id, orgA.id));
    }
  });
});

describe("getLaborWarnings isolation", () => {
  it("never surfaces another org's staff in its violations", async () => {
    const db = getRawDb();
    const start = "2026-09-07"; // a Monday, unused by any other test's fixture data
    const end = "2026-09-14";
    const dates = ["07", "08", "09", "10", "11", "12", "13"].map((d) => `2026-09-${d}`);

    // 7 consecutive confirmed days trips the default 6-day limit.
    await db.insert(shiftAssignments).values(
      dates.map((date) => ({
        organizationId: orgA.id,
        staffId: staffA.id,
        shiftTypeId: shiftTypeA.id,
        date,
      })),
    );

    try {
      const warningsA = await getLaborWarnings(orgA.id, start, end);
      expect(warningsA.consecutiveDayViolations).toHaveLength(1);
      expect(warningsA.consecutiveDayViolations[0].staffId).toBe(staffA.id);

      const warningsB = await getLaborWarnings(orgB.id, start, end);
      expect(warningsB.consecutiveDayViolations).toHaveLength(0);
      expect(warningsB.hoursViolations).toHaveLength(0);
      expect(warningsB.breakViolations).toHaveLength(0);
    } finally {
      await db
        .delete(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.organizationId, orgA.id),
            eq(shiftAssignments.staffId, staffA.id),
            gte(shiftAssignments.date, start),
            lt(shiftAssignments.date, end),
          ),
        );
    }
  });
});

describe("getStaffPayrollEstimate isolation", () => {
  // Dedicated staff + a month no other test in this file touches: staffA
  // picks up extra confirmed June rows from the setShiftAssignment and
  // time-off describe blocks above (both leave their writes in place), so
  // reusing it here would make this suite's expected totals depend on test
  // execution order elsewhere in the file. Fresh rows sidestep that.
  let payrollStaffA: { id: string };
  let payrollStaffB: { id: string };
  const PAYROLL_SHIFT_DATE = "2026-10-05";
  const PAYROLL_MONTH_ANCHOR = "2026-10-15";

  beforeAll(async () => {
    const db = getRawDb();
    [payrollStaffA] = await db
      .insert(staff)
      .values({ organizationId: orgA.id, name: "給与テストA" })
      .returning({ id: staff.id });
    [payrollStaffB] = await db
      .insert(staff)
      .values({ organizationId: orgB.id, name: "給与テストB" })
      .returning({ id: staff.id });

    await db.insert(staffCompensation).values({
      organizationId: orgA.id,
      staffId: payrollStaffA.id,
      hourlyWage: 1200,
    });
    await db.insert(staffCompensation).values({
      organizationId: orgB.id,
      staffId: payrollStaffB.id,
      hourlyWage: 1500,
    });

    // Only payrollStaffA gets a shift — payrollStaffB stays unworked so a
    // cross-tenant mix-up would surface as totalHours > 0 for org B below.
    await db.insert(shiftAssignments).values({
      organizationId: orgA.id,
      staffId: payrollStaffA.id,
      shiftTypeId: shiftTypeA.id,
      date: PAYROLL_SHIFT_DATE,
    });
  });

  afterAll(async () => {
    // Unlike staffA/staffB (shared fixtures other describe blocks still
    // read), these two are private to this block — leaving them behind
    // would skew any test appended later that counts all of orgA's or
    // orgB's staff (e.g. listStaff, generateDraftShifts's eligible pool).
    const db = getRawDb();
    await db.delete(staff).where(eq(staff.id, payrollStaffA.id));
    await db.delete(staff).where(eq(staff.id, payrollStaffB.id));
  });

  it("computes the estimate from the calling org's own wage and shifts only", async () => {
    // shiftTypeA is 07:00-16:00 with no break -> 9h x hourlyWage 1200 = 10800.
    const estimate = await getStaffPayrollEstimate(
      orgA.id,
      payrollStaffA.id,
      "owner",
      PAYROLL_MONTH_ANCHOR,
    );
    expect(estimate).toEqual({ hourlyWage: 1200, totalHours: 9, estimatedPay: 10800 });
  });

  it("returns null for a non-owner role even for the caller's own org", async () => {
    expect(
      await getStaffPayrollEstimate(orgA.id, payrollStaffA.id, "staff", PAYROLL_MONTH_ANCHOR),
    ).toBeNull();
    expect(
      await getStaffPayrollEstimate(orgA.id, payrollStaffA.id, "admin", PAYROLL_MONTH_ANCHOR),
    ).toBeNull();
  });

  it("returns null when staffId belongs to a different org instead of leaking it", async () => {
    expect(
      await getStaffPayrollEstimate(orgA.id, payrollStaffB.id, "owner", PAYROLL_MONTH_ANCHOR),
    ).toBeNull();
  });

  it("never mixes org B's wage or shifts into org A's estimate", async () => {
    const estimateB = await getStaffPayrollEstimate(
      orgB.id,
      payrollStaffB.id,
      "owner",
      PAYROLL_MONTH_ANCHOR,
    );
    expect(estimateB).toEqual({ hourlyWage: 1500, totalHours: 0, estimatedPay: 0 });
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
