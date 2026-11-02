import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/env";

/** Supabase client untuk Server Component, Server Action, dan Route Handler (memakai sesi user). */
export async function createClient() {
  const env = serverEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.SUPABASE_INTERNAL_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Dipanggil dari Server Component: cookie tidak bisa ditulis, sesi di-refresh oleh proxy.
          }
        },
      },
    },
  );
}
