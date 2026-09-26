"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { provisionOrganizationCore } from "@/lib/auth/provision";
import { createShiftTypeCore } from "@/lib/shift-types/write";
import { createStaffCore } from "@/lib/staff/write";
import { generateDraftShifts as generateDraftShiftsCore } from "@/lib/shifts/generate";
import { getAssignmentsForOrgRange } from "@/lib/shifts/queries";
import { listStaff } from "@/lib/staff/queries";
import { listShiftTypes } from "@/lib/shift-types/queries";
import { addDays, datesInWeek, mondayOf, todayInTimezone } from "@/lib/date";
import { INDUSTRY_OPTIONS, INDUSTRY_SHIFT_TYPE_PRESETS, type IndustryKey } from "@/lib/shift-types/presets";

export interface OnboardingInput {
  businessName: string;
  industryKey: IndustryKey;
  /** Shift-type codes toggled off in ステップ1「勤務の確認」— everything else in the industry preset gets created. */
  disabledShiftTypeCodes: string[];
  staffNames: string[];
}

/** The current week's draft, for ステップ3「できあがり」(design_handoff … README「1a」) to show before it's confirmed. */
export interface OnboardingDraft {
  dates: string[];
  staff: { id: string; name: string }[];
  shiftTypes: { id: string; code: string; name: string }[];
  assignments: { staffId: string; date: string; shiftTypeId: string }[];
}

const MAX_STAFF_NAMES = 100;

/**
 * Runs the whole 3-step onboarding wizard's write side in one call once the
 * visitor has verified OTP and reached the final "できあがり" step
 * (design_handoff_shift_bright_flow/README.md, 1a): creates the organization,
 * the industry's shift types, each named staff member, then a first draft
 * for the current week so the "下書き確認" screen has something to show.
 *
 * Reuses the same *Core functions the regular settings screens call
 * (lib/shift-types/write.ts, lib/staff/write.ts, lib/shifts/generate.ts) so
 * this is just "create several things through the existing single-item
 * actions," not a parallel write path.
 *
 * Once the organization itself exists, this never reports an error back to
 * the wizard — only the org-creation step can. A shift-type/staff write
 * failing partway through used to surface as an error inviting the visitor
 * to tap the button again, which called this whole function a second time
 * and provisioned a *second* organization (exactly the duplicate-org bug
 * PR #5 fixed for the old flow, reintroduced here). D1 has no multi-step
 * transaction that could span "create org, then conditionally create N more
 * rows," so instead: best-effort past that point, skipped items are simply
 * missing afterwards (fixable from the normal settings/staff screens), and
 * the wizard always finishes and lands on /today once the org is real.
 */
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<{ error: string | null; draft: OnboardingDraft | null }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "ログインが必要です", draft: null };

  const businessName = input.businessName.trim();
  if (!businessName) return { error: "事業所名を入力してください", draft: null };
  if (!INDUSTRY_OPTIONS.some((o) => o.key === input.industryKey)) {
    return { error: "業種を選び直してください", draft: null };
  }

  const orgResult = await provisionOrganizationCore(businessName, session.user.id, input.industryKey);
  if (!orgResult.organizationId) return { error: orgResult.error, draft: null };
  const { organizationId } = orgResult;

  const presets = INDUSTRY_SHIFT_TYPE_PRESETS[input.industryKey];
  const enabledPresets = presets.filter((p) => !input.disabledShiftTypeCodes.includes(p.input.code));
  let createdShiftTypeCount = 0;
  for (const [index, p] of enabledPresets.entries()) {
    const result = await createShiftTypeCore(
      organizationId,
      { ...p.input, sortOrder: index },
      session.user.id,
    );
    if (!result.error) createdShiftTypeCount++;
  }

  let createdStaffCount = 0;
  for (const rawName of input.staffNames.slice(0, MAX_STAFF_NAMES)) {
    const name = rawName.trim();
    if (!name) continue;
    const result = await createStaffCore(
      organizationId,
      "owner",
      { name, roleLabel: "", fixedDaysOff: [], unavailableShiftTypeIds: [], hourlyWage: null },
      session.user.id,
    );
    if (!result.error) createdStaffCount++;
  }

  if (createdShiftTypeCount === 0 || createdStaffCount === 0) {
    return { error: null, draft: null };
  }

  const monday = mondayOf(todayInTimezone());
  const weekEndExclusive = addDays(monday, 7);
  // Best-effort: a generation failure here (e.g. genuinely nobody available
  // for a slot) shouldn't block finishing signup — the manager can always
  // generate again from the week view, and the wizard just skips ステップ3
  // below when there's nothing to show.
  await generateDraftShiftsCore(organizationId, monday, weekEndExclusive);

  const [staff, shiftTypes, assignments] = await Promise.all([
    listStaff(organizationId),
    listShiftTypes(organizationId),
    getAssignmentsForOrgRange(organizationId, monday, weekEndExclusive, { includeDrafts: true }),
  ]);

  if (assignments.length === 0) {
    return { error: null, draft: null };
  }

  return {
    error: null,
    draft: {
      dates: datesInWeek(monday),
      staff: staff.map((s) => ({ id: s.id, name: s.name })),
      shiftTypes: shiftTypes.map((t) => ({ id: t.id, code: t.code, name: t.name })),
      assignments: assignments.map((a) => ({
        staffId: a.staffId,
        date: a.date,
        shiftTypeId: a.shiftTypeId,
      })),
    },
  };
}
