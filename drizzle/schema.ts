import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * D1/SQLite schema — ported from the original Postgres design
 * (see docs/plan.md "データモデル(D1/SQLite版)"). Conversions from the
 * Postgres version:
 *   - array columns (fixed_days_off, unavailable_shift_type_ids) -> TEXT
 *     columns with Drizzle's `mode: "json"`
 *   - uuid primary keys (gen_random_uuid()) -> TEXT + crypto.randomUUID()
 *   - timestamptz -> INTEGER (unix seconds), `mode: "timestamp"`
 *
 * There is no RLS here — tenant isolation is enforced by never importing
 * this schema's tables outside lib/db/scopedClient.ts (see
 * eslint.config.mjs) and by the cross-tenant isolation test suite
 * (lib/db/scopedClient.isolation.test.ts).
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const organizations = sqliteTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  businessType: text("business_type"),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  // 勤務ルール設定 (docs/plan.md 参照) — org-configurable thresholds, not a
  // restatement of the Labor Standards Act. See lib/labor-rules.ts.
  maxConsecutiveDays: integer("max_consecutive_days").notNull().default(6),
  maxWeeklyHours: integer("max_weekly_hours").notNull().default(40),
  maxMonthlyHours: integer("max_monthly_hours").notNull().default(160),
  minBreakMinutesOverSixHours: integer("min_break_minutes_over_6h").notNull().default(45),
  minBreakMinutesOverEightHours: integer("min_break_minutes_over_8h").notNull().default(60),
  createdAt: createdAt(),
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // References Better Auth's `user.id` (defined by the auth schema,
    // generated separately — see lib/auth/config.ts).
    userId: text("user_id").notNull(),
    role: text("role").notNull().$type<"owner" | "admin" | "staff">(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("memberships_org_user_unique").on(table.organizationId, table.userId),
    // Every RLS-equivalent policy in lib/db/scopedClient.ts joins through
    // this table keyed on (user_id, organization_id) — see docs/plan.md.
    index("memberships_user_org_idx").on(table.userId, table.organizationId),
    check("memberships_role_check", sql`${table.role} in ('owner', 'admin', 'staff')`),
  ],
);

export const staff = sqliteTable(
  "staff",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id"), // Better Auth user.id, once a staff member gets self-service login (Phase 3)
    name: text("name").notNull(),
    roleLabel: text("role_label"),
    fixedDaysOff: text("fixed_days_off", { mode: "json" }).$type<number[]>().notNull().default([]), // 0=Sun..6=Sat
    unavailableShiftTypeIds: text("unavailable_shift_type_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [index("staff_org_idx").on(table.organizationId)],
);

// Split from `staff` on purpose: without RLS, the scoped client is the only
// thing keeping a staff member's own read access from including a
// coworker's wage — see docs/plan.md "時給を`staff`から分離する理由".
export const staffCompensation = sqliteTable("staff_compensation", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  staffId: text("staff_id")
    .notNull()
    .unique()
    .references(() => staff.id, { onDelete: "cascade" }),
  hourlyWage: integer("hourly_wage").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const shiftTypes = sqliteTable(
  "shift_types",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    startTime: text("start_time").notNull(), // "HH:MM"
    endTime: text("end_time").notNull(), // "HH:MM"
    crossesMidnight: integer("crosses_midnight", { mode: "boolean" }).notNull().default(false),
    breakMinutes: integer("break_minutes").notNull().default(0),
    isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
    isBalanced: integer("is_balanced", { mode: "boolean" }).notNull().default(false),
    colorKey: text("color_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    unique("shift_types_org_code_unique").on(table.organizationId, table.code),
    index("shift_types_org_idx").on(table.organizationId),
  ],
);

// One row per staff x date x shift_type, not one JSON blob per staff (both
// legacy prototypes did the latter) — see docs/plan.md.
export const shiftAssignments = sqliteTable(
  "shift_assignments",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    shiftTypeId: text("shift_type_id")
      .notNull()
      .references(() => shiftTypes.id, { onDelete: "restrict" }),
    date: text("date").notNull(), // "YYYY-MM-DD"
    // auto-generate writes 'draft' rows for the manager to review before
    // 'confirmed' publishes them (docs/plan.md).
    status: text("status").notNull().default("confirmed").$type<"draft" | "confirmed">(),
    createdBy: text("created_by"), // Better Auth user.id
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    unique("shift_assignments_staff_date_type_unique").on(
      table.staffId,
      table.date,
      table.shiftTypeId,
    ),
    index("shift_assignments_org_date_idx").on(table.organizationId, table.date),
    index("shift_assignments_staff_date_idx").on(table.staffId, table.date),
    check("shift_assignments_status_check", sql`${table.status} in ('draft', 'confirmed')`),
  ],
);

export const timeOffRequests = sqliteTable(
  "time_off_requests",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    status: text("status").notNull().default("requested").$type<"requested" | "acknowledged">(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("time_off_requests_staff_date_unique").on(table.staffId, table.date),
    index("time_off_requests_org_idx").on(table.organizationId),
    check("time_off_requests_status_check", sql`${table.status} in ('requested', 'acknowledged')`),
  ],
);

export const swapRequests = sqliteTable(
  "swap_requests",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    fromStaffId: text("from_staff_id")
      .notNull()
      .references(() => staff.id),
    toStaffId: text("to_staff_id")
      .notNull()
      .references(() => staff.id),
    fromShiftTypeId: text("from_shift_type_id").references(() => shiftTypes.id),
    toShiftTypeId: text("to_shift_type_id").references(() => shiftTypes.id),
    status: text("status").notNull().default("pending").$type<"pending" | "approved" | "rejected">(),
    requestedBy: text("requested_by"), // Better Auth user.id
    decidedBy: text("decided_by"),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("swap_requests_org_date_idx").on(table.organizationId, table.date),
    check("swap_requests_status_check", sql`${table.status} in ('pending', 'approved', 'rejected')`),
  ],
);

export const subscriptions = sqliteTable("subscriptions", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // last processed Stripe webhook event id, for idempotency.
  stripeEventId: text("stripe_event_id"),
  plan: text("plan").notNull().default("trial").$type<"trial" | "standard" | "pro">(),
  status: text("status")
    .notNull()
    .default("trialing")
    .$type<"trialing" | "active" | "past_due" | "canceled">(),
  trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id"), // Better Auth user.id
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    diff: text("diff", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [index("audit_log_org_created_idx").on(table.organizationId, table.createdAt)],
);
