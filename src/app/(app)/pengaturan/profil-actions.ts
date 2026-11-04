"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { passwordChangeSchema, phoneSchema, type PasswordChangeInput } from "@/lib/validation/profile";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "profil");
const refresh = () => revalidatePath("/", "layout");

/** Jadikan lampiran yang baru diunggah sebagai foto profil saya */
export async function setAvatarAction(attachmentId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(attachmentId).success) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_avatar", { p_attachment_id: attachmentId });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function clearAvatarAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_my_avatar");
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function updatePhoneAction(phone: string): Promise<ActionResult> {
  const parsed = phoneSchema.safeParse(phone);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", { p_phone: parsed.data });
  if (error) return dbError(error);
  revalidatePath("/pengaturan");
  return done();
}

/** Ganti password sendiri: password saat ini diverifikasi dulu lewat klien terpisah (sesi tidak berubah). */
export async function changePasswordAction(input: PasswordChangeInput): Promise<ActionResult> {
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };

  const env = serverEnv();
  const probe = createSupabaseClient(env.SUPABASE_INTERNAL_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = await probe.auth.signInWithPassword({ email, password: parsed.data.current_password });
  if (check.error) return { ok: false, error: "Password saat ini salah." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.code === "weak_password" ? "Password terlalu lemah." : "Gagal mengganti password." };
  return done();
}
