import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type PermissionAction = "view" | "create" | "update" | "void" | "approve" | "export";

export type UserContext = {
  employee: { id: string; code: string; full_name: string; position: string | null; status: string; photo_url: string | null };
  branch: { id: string; code: string; name: string };
  is_superuser: boolean;
  roles: { code: string; name: string }[];
  /** Format "module:action:scope", contoh "sales:create:all" */
  permissions: string[];
};

/** Konteks karyawan yang sedang login, atau null. Di-cache per request. */
export const getUserContext = cache(async (): Promise<UserContext | null> => {
  // Data per user: render saat request (Supabase memakai Date.now() untuk cek kedaluwarsa sesi)
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_context");
  if (error || !data) return null;
  return data as UserContext;
});

/** Wajib login sebagai karyawan aktif; jika tidak, arahkan ke /login. */
export async function requireUser(): Promise<UserContext> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Cek izin di sisi aplikasi (menu & tombol). Penegakan sebenarnya tetap di RLS database. */
export function can(ctx: UserContext, module: string, action: PermissionAction = "view", allowOwn = true) {
  if (ctx.is_superuser) return true;
  return ctx.permissions.some((p) => {
    const [m, a, scope] = p.split(":");
    return m === module && a === action && (scope === "all" || allowOwn);
  });
}
