"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { can, getUserContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  accountSchema,
  createEmployeeSchema,
  employeeSchema,
  passwordResetSchema,
  pinSchema,
  roleSchema,
  rolesSchema,
  statusSchema,
  type AccountInput,
  type CreateEmployeeInput,
  type EmployeeInput,
  type PasswordResetInput,
  type PinInput,
  type RoleInput,
  type RolesInput,
  type StatusInput,
} from "@/lib/validation/employee";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Pesan dari fungsi database sudah berbahasa Indonesia (raise exception); error lain disamarkan.
const KNOWN_DB_CODES = new Set(["42501", "22023", "23514", "23505", "P0001", "P0002"]);
function dbError(error: PostgrestError): { ok: false; error: string } {
  if (KNOWN_DB_CODES.has(error.code)) return { ok: false, error: error.message };
  console.error("[karyawan] database error", error.code, error.message);
  return { ok: false, error: "Terjadi kesalahan saat menyimpan. Coba lagi." };
}

const invalid = (issues: { message: string }[]) => ({ ok: false as const, error: issues[0].message });

function authError(code?: string) {
  if (code === "email_exists") return "Email sudah dipakai akun lain.";
  if (code === "weak_password") return "Password terlalu lemah.";
  return "Gagal membuat akun login.";
}

/** Buat akun Auth lalu tautkan ke karyawan (izin dicek database). Akun dihapus lagi jika gagal. */
async function createLinkedAccount(employeeId: string, email: string, password: string): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
  });
  if (error || !created.user) return { ok: false, error: authError(error?.code) };

  const supabase = await createClient();
  const { error: linkError } = await supabase.rpc("link_employee_account", {
    p_employee_id: employeeId,
    p_user_id: created.user.id,
  });
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return dbError(linkError);
  }
  return { ok: true, data: undefined };
}

/** Pra-cek izin sebelum memakai Auth Admin API (penegakan utama tetap di database). */
async function allowed(action: "create" | "update") {
  const ctx = await getUserContext();
  return ctx !== null && can(ctx, "employees", action, false);
}

export async function createEmployeeAction(input: CreateEmployeeInput): Promise<ActionResult<{ id: string; warning?: string }>> {
  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!(await allowed("create"))) return { ok: false, error: "Anda tidak punya izin menambah karyawan." };

  const { role_ids, create_account, email, password, ...fields } = parsed.data;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_employee", { p_data: fields, p_role_ids: role_ids });
  if (error) return dbError(error);

  let warning: string | undefined;
  if (create_account) {
    const account = await createLinkedAccount(id as string, email, password);
    if (!account.ok) warning = `Karyawan tersimpan, tetapi akun login belum dibuat: ${account.error}`;
  }

  revalidatePath("/karyawan", "layout");
  return { ok: true, data: { id: id as string, warning } };
}

export async function updateEmployeeAction(id: string, input: EmployeeInput): Promise<ActionResult> {
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_employee", { p_employee_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  revalidatePath("/karyawan", "layout");
  return { ok: true, data: undefined };
}

export async function setEmployeeRolesAction(id: string, input: RolesInput): Promise<ActionResult> {
  const parsed = rolesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employee_roles", { p_employee_id: id, p_role_ids: parsed.data.role_ids });
  if (error) return dbError(error);
  revalidatePath("/karyawan", "layout");
  return { ok: true, data: undefined };
}

export async function setEmployeeStatusAction(id: string, input: StatusInput): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employee_status", {
    p_employee_id: id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
  });
  if (error) return dbError(error);
  revalidatePath("/karyawan", "layout");
  return { ok: true, data: undefined };
}

export async function createAccountAction(id: string, input: AccountInput): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!(await allowed("update"))) return { ok: false, error: "Anda tidak punya izin mengelola akun karyawan." };

  const result = await createLinkedAccount(id, parsed.data.email, parsed.data.password);
  if (result.ok) revalidatePath("/karyawan", "layout");
  return result;
}

export async function resetPasswordAction(id: string, input: PasswordResetInput): Promise<ActionResult> {
  const parsed = passwordResetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  // Database memastikan izin & melarang non-Owner mengatur akun Owner, lalu mencatat audit
  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("employee_account_for_reset", { p_employee_id: id });
  if (error) return dbError(error);

  const { error: authErr } = await createAdminClient().auth.admin.updateUserById(userId as string, {
    password: parsed.data.password,
  });
  if (authErr) return { ok: false, error: authErr.code === "weak_password" ? "Password terlalu lemah." : "Gagal mengganti password." };
  return { ok: true, data: undefined };
}

export async function setMyPinAction(input: PinInput): Promise<ActionResult> {
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_pin", { p_pin: parsed.data.pin });
  if (error) return dbError(error);
  revalidatePath("/karyawan", "layout");
  return { ok: true, data: undefined };
}

export async function saveRoleAction(roleId: string | null, input: RoleInput): Promise<ActionResult<{ id: string }>> {
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_role", {
    p_role_id: roleId,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_permissions: parsed.data.permissions,
  });
  if (error) return dbError(error);
  revalidatePath("/karyawan", "layout");
  return { ok: true, data: { id: data as string } };
}

export async function setRoleActiveAction(roleId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_role_active", { p_role_id: roleId, p_active: active });
  if (error) return dbError(error);
  revalidatePath("/karyawan", "layout");
  return { ok: true, data: undefined };
}
