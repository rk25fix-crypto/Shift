import { createClient } from "@/lib/supabase/server";

export interface ShiftTypeRecord {
  id: string;
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

export async function listShiftTypes(organizationId: string): Promise<ShiftTypeRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shift_types")
    .select(
      "id, code, name, start_time, end_time, crosses_midnight, break_minutes, is_required, is_balanced, color_key, sort_order",
    )
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("code");

  if (error) throw new Error(error.message);

  return (data ?? []).map(toShiftTypeRecord);
}

export async function getShiftType(
  organizationId: string,
  shiftTypeId: string,
): Promise<ShiftTypeRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shift_types")
    .select(
      "id, code, name, start_time, end_time, crosses_midnight, break_minutes, is_required, is_balanced, color_key, sort_order",
    )
    .eq("organization_id", organizationId)
    .eq("id", shiftTypeId)
    .maybeSingle();

  return data ? toShiftTypeRecord(data) : null;
}

interface ShiftTypeRow {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  break_minutes: number;
  is_required: boolean;
  is_balanced: boolean;
  color_key: string | null;
  sort_order: number;
}

function toShiftTypeRecord(row: ShiftTypeRow): ShiftTypeRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    crossesMidnight: row.crosses_midnight,
    breakMinutes: row.break_minutes,
    isRequired: row.is_required,
    isBalanced: row.is_balanced,
    colorKey: row.color_key,
    sortOrder: row.sort_order,
  };
}
