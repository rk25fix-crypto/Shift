"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isManager, requireCurrentMembership } from "@/lib/org/current";

export interface StaffInput {
  name: string;
  roleLabel: string;
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
  /** Only ever written when the caller is an owner — see docs/plan.md "時給をstaffから分離する理由". */
  hourlyWage: number | null;
}

export async function createStaff(input: StaffInput): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const supabase = await createClient();
  const { data: staff, error } = await supabase
    .from("staff")
    .insert({
      organization_id: organizationId,
      name: input.name,
      role_label: input.roleLabel || null,
      fixed_days_off: input.fixedDaysOff,
      unavailable_shift_type_ids: input.unavailableShiftTypeIds,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (role === "owner" && input.hourlyWage != null) {
    const { error: compensationError } = await supabase.from("staff_compensation").insert({
      organization_id: organizationId,
      staff_id: staff.id,
      hourly_wage: input.hourlyWage,
    });
    if (compensationError) return { error: compensationError.message };
  }

  revalidatePath("/staff");
  return { error: null };
}

export async function updateStaff(
  staffId: string,
  input: StaffInput,
): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({
      name: input.name,
      role_label: input.roleLabel || null,
      fixed_days_off: input.fixedDaysOff,
      unavailable_shift_type_ids: input.unavailableShiftTypeIds,
    })
    .eq("id", staffId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  if (role === "owner" && input.hourlyWage != null) {
    const { error: compensationError } = await supabase
      .from("staff_compensation")
      .upsert(
        { organization_id: organizationId, staff_id: staffId, hourly_wage: input.hourlyWage },
        { onConflict: "staff_id" },
      );
    if (compensationError) return { error: compensationError.message };
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
  return { error: null };
}

export async function deactivateStaff(staffId: string): Promise<{ error: string | null }> {
  const { organizationId, role } = await requireCurrentMembership();
  if (!isManager(role)) return { error: "権限がありません" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ is_active: false })
    .eq("id", staffId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { error: null };
}
