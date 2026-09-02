import { createClient } from "@/lib/supabase/server";
import { monthOf, nextMonth } from "@/lib/date";

export interface Assignment {
  id: string;
  staffId: string;
  shiftTypeId: string;
  date: string;
}

export async function getAssignmentsForDate(
  organizationId: string,
  date: string,
): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("id, staff_id, shift_type_id, date")
    .eq("organization_id", organizationId)
    .eq("date", date)
    .eq("status", "confirmed");

  if (error) throw new Error(error.message);
  return (data ?? []).map(toAssignment);
}

export async function getAssignmentsForStaffMonth(
  organizationId: string,
  staffId: string,
  date: string,
): Promise<Assignment[]> {
  const month = monthOf(date);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("id, staff_id, shift_type_id, date")
    .eq("organization_id", organizationId)
    .eq("staff_id", staffId)
    .eq("status", "confirmed")
    .gte("date", `${month}-01`)
    .lt("date", `${nextMonth(month)}-01`)
    .order("date");

  if (error) throw new Error(error.message);
  return (data ?? []).map(toAssignment);
}

export async function getAssignmentsForOrgMonth(
  organizationId: string,
  month: string,
): Promise<Assignment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("id, staff_id, shift_type_id, date")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .gte("date", `${month}-01`)
    .lt("date", `${nextMonth(month)}-01`)
    .order("date");

  if (error) throw new Error(error.message);
  return (data ?? []).map(toAssignment);
}

interface AssignmentRow {
  id: string;
  staff_id: string;
  shift_type_id: string;
  date: string;
}

function toAssignment(row: AssignmentRow): Assignment {
  return { id: row.id, staffId: row.staff_id, shiftTypeId: row.shift_type_id, date: row.date };
}
