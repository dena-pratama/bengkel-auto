import { z } from "zod";

// Aturan sama dengan app.employee_fields() di database; di sini untuk pesan cepat di form.
const optional = (max = 100) => z.string().trim().max(max, `Maksimal ${max} karakter`);
const digitsOnly = (v: string) => v.replace(/[\s-]/g, "");

export const EMPLOYEE_STATUS = ["active", "on_leave", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[number];
export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: "Aktif",
  on_leave: "Cuti",
  inactive: "Nonaktif",
};

export const employeeSchema = z.object({
  full_name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100, "Maksimal 100 karakter"),
  nik: optional(20).refine((v) => v === "" || /^[0-9]{16}$/.test(digitsOnly(v)), "NIK harus 16 digit angka"),
  phone: optional(20).refine(
    (v) => v === "" || /^(\+62|62|0)8[0-9]{7,12}$/.test(digitsOnly(v)),
    "Nomor HP tidak valid (contoh 0812xxxxxxx)",
  ),
  position: optional(),
  hire_date: z.string().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid"),
  bank_name: optional(50),
  bank_account_number: optional(30).refine(
    (v) => v === "" || /^[0-9]{5,20}$/.test(digitsOnly(v)),
    "Nomor rekening hanya angka (5-20 digit)",
  ),
  bank_account_name: optional(),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const emptyEmployee: EmployeeInput = {
  full_name: "",
  nik: "",
  phone: "",
  position: "",
  hire_date: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
};

const roleIds = z.array(z.uuid()).min(1, "Pilih minimal satu role");

// PRD §18: password minimal 8 karakter
const password = z.string().min(8, "Password minimal 8 karakter").max(72, "Maksimal 72 karakter");

export const accountSchema = z
  .object({
    email: z.email("Format email tidak valid"),
    password,
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Konfirmasi password tidak sama",
  });
export type AccountInput = z.infer<typeof accountSchema>;

export const createEmployeeSchema = employeeSchema
  .extend({
    role_ids: roleIds,
    create_account: z.boolean(),
    email: z.string().trim(),
    password: z.string(),
    confirm_password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.create_account) return;
    const parsed = accountSchema.safeParse(v);
    for (const issue of parsed.error?.issues ?? []) ctx.addIssue({ ...issue, code: "custom" });
  });
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const rolesSchema = z.object({ role_ids: roleIds });
export type RolesInput = z.infer<typeof rolesSchema>;

export const statusSchema = z
  .object({ status: z.enum(EMPLOYEE_STATUS), reason: z.string().trim().max(200, "Maksimal 200 karakter") })
  .refine((v) => v.status !== "inactive" || v.reason.length >= 3, {
    path: ["reason"],
    message: "Alasan wajib diisi saat menonaktifkan karyawan",
  });
export type StatusInput = z.infer<typeof statusSchema>;

export const passwordResetSchema = z
  .object({ password, confirm_password: z.string() })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Konfirmasi password tidak sama",
  });
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export const pinSchema = z
  .object({ pin: z.string().regex(/^[0-9]{6}$/, "PIN harus 6 digit angka"), confirm_pin: z.string() })
  .refine((v) => v.pin === v.confirm_pin, { path: ["confirm_pin"], message: "Konfirmasi PIN tidak sama" });
export type PinInput = z.infer<typeof pinSchema>;

export const PERMISSION_ACTIONS = ["view", "create", "update", "void", "approve", "export"] as const;
export type PermissionActionKey = (typeof PERMISSION_ACTIONS)[number];
export const ACTION_LABEL: Record<PermissionActionKey, string> = {
  view: "Lihat",
  create: "Buat",
  update: "Ubah",
  void: "Batal",
  approve: "Setujui",
  export: "Ekspor",
};
/** Aksi yang punya lingkup "hanya data sendiri" (PRD §16: S & U) */
export const OWN_SCOPE_ACTIONS: PermissionActionKey[] = ["view", "update"];

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Nama role minimal 2 karakter").max(60, "Maksimal 60 karakter"),
  description: z.string().trim().max(200, "Maksimal 200 karakter"),
  permissions: z.array(z.object({ permission_id: z.uuid(), scope: z.enum(["all", "own"]) })),
});
export type RoleInput = z.infer<typeof roleSchema>;
