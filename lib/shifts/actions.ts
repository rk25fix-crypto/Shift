"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isManager, requireCurrentMembership } from "@/lib/org/current";

/**
 * Sets (or clears, when shiftTypeId is null) the one shift a staff member
 * holds on a given date. The schema allows more than one shift per day
 * (shift_assignments' unique key includes shift_type_id — see
 * docs/plan.md), but the Today view keeps to "tap a chip, pick one shift"
 * for Phase 1a, matching lib/shift-generator's one-shift-a-day model. A
 * manager who genuinely needs a second shift that day can add it once the
 * data model's multi-shift support gets a UI (Phase 1b+).
 */
export async function assignShift(
  staffId: string,
  date: string,
  shiftTypeId: string | null,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("shift_assignments")
    .delete()
    .eq("organization_id", organizationId)
    .eq("staff_id", staffId)
    .eq("date", date);

  if (deleteError) return { error: deleteError.message };

  if (shiftTypeId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("shift_assignments").insert({
      organization_id: organizationId,
      staff_id: staffId,
      shift_type_id: shiftTypeId,
      date,
      status: "confirmed",
      created_by: user?.id ?? null,
    });

    if (insertError) return { error: insertError.message };
  }

  revalidatePath("/today");
  revalidatePath(`/staff/${staffId}`);
  return { error: null };
}
