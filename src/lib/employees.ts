import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EmployeeStatus, PermissionActionKey } from "@/lib/validation/employee";

// Kolom eksplisit: pin_hash tidak punya grant baca, jadi `select *` akan ditolak database.
const EMPLOYEE_COLUMNS =
  "id, code, full_name, nik, phone, position, hire_date, bank_name, bank_account_number, bank_account_name, status, created_at";

export type RoleRef = { id: string; code: string; name: string; is_superuser: boolean; is_active: boolean };

export type Employee = {
  id: string;
  code: string;
  full_name: string;
  nik: string | null;
  phone: string | null;
  position: string | null;
  hire_date: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  status: EmployeeStatus;
  created_at: string;
  email: string | null;
  roles: RoleRef[];
};

type EmployeeRow = Omit<Employee, "email" | "roles"> & {
  profiles: { email: string } | null;
  employee_roles: { roles: RoleRef | null }[];
};

const toEmployee = ({ profiles, employee_roles, ...e }: EmployeeRow): Employee => ({
  ...e,
  email: profiles?.email ?? null,
  roles: employee_roles
    .map((er) => er.roles)
    .filter((r): r is RoleRef => r !== null)
    .sort((a, b) => Number(b.is_superuser) - Number(a.is_superuser) || a.name.localeCompare(b.name, "id")),
});

const EMPLOYEE_SELECT = `${EMPLOYEE_COLUMNS}, profiles(email), employee_roles(roles(id, code, name, is_superuser, is_active))`;

/** Daftar karyawan yang boleh dilihat user (RLS menyaring). */
export async function listEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select(EMPLOYEE_SELECT).order("full_name");
  if (error) throw new Error(`Gagal memuat karyawan: ${error.message}`);
  return (data as unknown as EmployeeRow[]).map(toEmployee);
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select(EMPLOYEE_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal memuat karyawan: ${error.message}`);
  return data ? toEmployee(data as unknown as EmployeeRow) : null;
}

export type StatusHistory = {
  id: string;
  old_status: EmployeeStatus | null;
  new_status: EmployeeStatus;
  reason: string | null;
  created_at: string;
};

export async function getStatusHistory(employeeId: string): Promise<StatusHistory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_status_history")
    .select("id, old_status, new_status, reason, created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Gagal memuat riwayat status: ${error.message}`);
  return data as StatusHistory[];
}

export async function employeeHasPin(employeeId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("employee_has_pin", { p_employee_id: employeeId });
  return data === true;
}

export type Role = RoleRef & {
  description: string | null;
  is_system: boolean;
  member_count: number;
  permission_count: number;
};

export async function listRoles(): Promise<Role[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, code, name, description, is_system, is_superuser, is_active, employee_roles(count), role_permissions(count)")
    .order("is_superuser", { ascending: false })
    .order("is_system", { ascending: false })
    .order("name");
  if (error) throw new Error(`Gagal memuat role: ${error.message}`);
  type Row = Omit<Role, "member_count" | "permission_count"> & {
    employee_roles: { count: number }[];
    role_permissions: { count: number }[];
  };
  return (data as unknown as Row[]).map(({ employee_roles, role_permissions, ...r }) => ({
    ...r,
    member_count: employee_roles[0]?.count ?? 0,
    permission_count: role_permissions[0]?.count ?? 0,
  }));
}

export type Permission = { id: string; module: string; module_label: string; action: PermissionActionKey; sort_order: number };

export async function listPermissions(): Promise<Permission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("id, module, module_label, action, sort_order")
    .order("sort_order");
  if (error) throw new Error(`Gagal memuat katalog izin: ${error.message}`);
  return data as Permission[];
}

export type RoleDetail = Omit<Role, "member_count" | "permission_count"> & {
  permissions: { permission_id: string; scope: "all" | "own" }[];
};

export async function getRole(id: string): Promise<RoleDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, code, name, description, is_system, is_superuser, is_active, role_permissions(permission_id, scope)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat role: ${error.message}`);
  if (!data) return null;
  const { role_permissions, ...role } = data as unknown as Omit<RoleDetail, "permissions"> & {
    role_permissions: RoleDetail["permissions"];
  };
  return { ...role, permissions: role_permissions };
}
