"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { provisionOrganizationCore } from "@/lib/auth/actions";
import { createShiftTypeCore } from "@/lib/shift-types/write";
import { createStaffCore } from "@/lib/staff/write";
import { generateDraftShifts as generateDraftShiftsCore } from "@/lib/shifts/generate";
import { addDays, mondayOf, todayInTimezone } from "@/lib/date";
import { INDUSTRY_SHIFT_TYPE_PRESETS, type IndustryKey } from "@/lib/shift-types/presets";

export interface OnboardingInput {
  businessName: string;
  industryKey: IndustryKey;
  /** Shift-type codes toggled off in ステップ1「勤務の確認」— everything else in the industry preset gets created. */
  disabledShiftTypeCodes: string[];
  staffNames: string[];
}

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
 */
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<{ error: string | null }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "ログインが必要です" };

  const orgResult = await provisionOrganizationCore(
    input.businessName,
    session.user.id,
    input.industryKey,
  );
  if (!orgResult.organizationId) return { error: orgResult.error };
  const { organizationId } = orgResult;

  const presets = INDUSTRY_SHIFT_TYPE_PRESETS[input.industryKey] ?? INDUSTRY_SHIFT_TYPE_PRESETS.other;
  const enabledPresets = presets.filter((p) => !input.disabledShiftTypeCodes.includes(p.input.code));
  for (const [index, p] of enabledPresets.entries()) {
    const result = await createShiftTypeCore(
      organizationId,
      { ...p.input, sortOrder: index },
      session.user.id,
    );
    if (result.error) return { error: result.error };
  }

  for (const rawName of input.staffNames) {
    const name = rawName.trim();
    if (!name) continue;
    const result = await createStaffCore(
      organizationId,
      "owner",
      { name, roleLabel: "", fixedDaysOff: [], unavailableShiftTypeIds: [], hourlyWage: null },
      session.user.id,
    );
    if (result.error) return { error: result.error };
  }

  const hasStaff = input.staffNames.some((n) => n.trim());
  if (enabledPresets.length > 0 && hasStaff) {
    const monday = mondayOf(todayInTimezone());
    // Best-effort: a generation failure here (e.g. genuinely nobody
    // available for a slot) shouldn't block finishing signup — the manager
    // can always generate again from the week view.
    await generateDraftShiftsCore(organizationId, monday, addDays(monday, 7));
  }

  return { error: null };
}
