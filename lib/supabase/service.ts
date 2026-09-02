import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role client. This BYPASSES Row-Level Security entirely, so tenant
 * isolation is not enforced when using it. Restricted by eslint.config.mjs
 * to the Stripe webhook handler and lib/admin/** batch jobs — anywhere else
 * a missed org_id filter here is a cross-tenant data leak, not just a bug.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
