import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/** Supabase client service_role: melewati RLS. Hanya untuk operasi server yang sudah divalidasi. */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient(
    env.SUPABASE_INTERNAL_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
