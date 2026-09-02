import { createClient } from "@/lib/supabase/server";

export type MembershipRole = "owner" | "admin" | "staff";

export interface CurrentMembership {
  organizationId: string;
  role: MembershipRole;
}

/**
 * Resolves the logged-in user's organization + role. A user can belong to
 * more than one organization (docs/plan.md, "1ユーザーが複数事業所を持つ
 * ケース"), but the org switcher is Phase 3 — until then every page/action
 * uses the first membership found, via this single shared lookup.
 */
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return { organizationId: data.organization_id, role: data.role };
}

/** Same as getCurrentMembership(), but throws for pages/actions that require an org context to render at all. */
export async function requireCurrentMembership(): Promise<CurrentMembership> {
  const membership = await getCurrentMembership();
  if (!membership) {
    throw new Error("この操作には事業所への所属が必要です。");
  }
  return membership;
}

export function isManager(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}
