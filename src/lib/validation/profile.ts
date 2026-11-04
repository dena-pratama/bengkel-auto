import { z } from "zod";

// PRD §18: password minimal 8 karakter
export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Isi password saat ini"),
    password: z.string().min(8, "Password baru minimal 8 karakter").max(72, "Maksimal 72 karakter"),
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, { path: ["confirm_password"], message: "Konfirmasi password tidak sama" })
  .refine((v) => v.password !== v.current_password, { path: ["password"], message: "Password baru harus berbeda dari password saat ini" });
export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;

export const phoneSchema = z.string().trim().max(20, "Maksimal 20 karakter");
