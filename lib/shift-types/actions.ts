"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isManager, requireCurrentMembership } from "@/lib/org/current";

export interface ShiftTypeInput {
  code: string;
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  crossesMidnight: boolean;
  breakMinutes: number;
  isRequired: boolean;
  isBalanced: boolean;
  colorKey: string | null;
  sortOrder: number;
}

export async function createShiftType(
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const supabase = await createClient();
  const { error } = await supabase.from("shift_types").insert({
    organization_id: organizationId,
    code: input.code,
    name: input.name,
    start_time: input.startTime,
    end_time: input.endTime,
    crosses_midnight: input.crossesMidnight,
    break_minutes: input.breakMinutes,
    is_required: input.isRequired,
    is_balanced: input.isBalanced,
    color_key: input.colorKey,
    sort_order: input.sortOrder,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/shift-types");
  return { error: null };
}

export async function updateShiftType(
  shiftTypeId: string,
  input: ShiftTypeInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_types")
    .update({
      code: input.code,
      name: input.name,
      start_time: input.startTime,
      end_time: input.endTime,
      crosses_midnight: input.crossesMidnight,
      break_minutes: input.breakMinutes,
      is_required: input.isRequired,
      is_balanced: input.isBalanced,
      color_key: input.colorKey,
      sort_order: input.sortOrder,
    })
    .eq("id", shiftTypeId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/settings/shift-types");
  return { error: null };
}

export async function deleteShiftType(shiftTypeId: string): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_types")
    .delete()
    .eq("id", shiftTypeId)
    .eq("organization_id", organizationId);

  // shift_assignments references shift_types with ON DELETE RESTRICT, so a
  // shift type still in use surfaces as a foreign-key violation here rather
  // than silently orphaning schedule data.
  if (error) {
    return {
      error: error.code === "23503" ? "このシフト種別は使用中のため削除できません" : error.message,
    };
  }

  revalidatePath("/settings/shift-types");
  return { error: null };
}
