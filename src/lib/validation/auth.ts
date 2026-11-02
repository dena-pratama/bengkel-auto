import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// PRD §18: password minimal 8 karakter
export const setupOwnerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    email: z.email("Format email tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter").max(72),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak sama",
  });
export type SetupOwnerInput = z.infer<typeof setupOwnerSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string };
