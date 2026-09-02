import { createClient } from "@/lib/supabase/server";

export interface StaffRecord {
  id: string;
  name: string;
  roleLabel: string | null;
  fixedDaysOff: number[];
  unavailableShiftTypeIds: string[];
  isActive: boolean;
}

export async function listStaff(organizationId: string): Promise<StaffRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role_label, fixed_days_off, unavailable_shift_type_ids, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map(toStaffRecord);
}

export async function getStaff(
  organizationId: string,
  staffId: string,
): Promise<StaffRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("id, name, role_label, fixed_days_off, unavailable_shift_type_ids, is_active")
    .eq("organization_id", organizationId)
    .eq("id", staffId)
    .maybeSingle();

  return data ? toStaffRecord(data) : null;
}

/** Owner-only per RLS (compensation_owner_select policy) — returns null for non-owners rather than throwing. */
export async function getStaffHourlyWage(staffId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_compensation")
    .select("hourly_wage")
    .eq("staff_id", staffId)
    .maybeSingle();

  return data?.hourly_wage ?? null;
}

interface StaffRow {
  id: string;
  name: string;
  role_label: string | null;
  fixed_days_off: number[] | null;
  unavailable_shift_type_ids: string[] | null;
  is_active: boolean;
}

function toStaffRecord(row: StaffRow): StaffRecord {
  return {
    id: row.id,
    name: row.name,
    roleLabel: row.role_label,
    fixedDaysOff: row.fixed_days_off ?? [],
    unavailableShiftTypeIds: row.unavailable_shift_type_ids ?? [],
    isActive: row.is_active,
  };
}
