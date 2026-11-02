"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loginSchema,
  setupOwnerSchema,
  type ActionResult,
  type LoginInput,
  type SetupOwnerInput,
} from "@/lib/validation/auth";

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "user_banned") return { ok: false, error: "Akun ini dinonaktifkan. Hubungi Owner." };
    if (error.code === "invalid_credentials") return { ok: false, error: "Email atau password salah." };
    return { ok: false, error: "Gagal masuk. Coba lagi beberapa saat." };
  }

  // Akun login wajib terhubung ke karyawan aktif
  const { data: ctx } = await supabase.rpc("my_context");
  if (!ctx) {
    await supabase.auth.signOut();
    return { ok: false, error: "Akun belum terhubung ke data karyawan aktif." };
  }

  redirect("/dashboard");
}

export async function setupOwnerAction(input: SetupOwnerInput): Promise<ActionResult> {
  const parsed = setupOwnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data: needsSetup } = await admin.rpc("needs_setup");
  if (!needsSetup) return { ok: false, error: "Setup sudah pernah dilakukan. Silakan masuk." };

  const email = parsed.data.email.toLowerCase();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return {
      ok: false,
      error: createError?.code === "email_exists" ? "Email sudah terdaftar." : "Gagal membuat akun.",
    };
  }

  const { error: bootstrapError } = await admin.rpc("bootstrap_owner", {
    p_user_id: created.user.id,
    p_full_name: parsed.data.fullName,
    p_email: email,
  });
  if (bootstrapError) {
    // Jangan tinggalkan akun auth yatim jika pembuatan karyawan gagal
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Gagal menyimpan data Owner. Coba lagi." };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
