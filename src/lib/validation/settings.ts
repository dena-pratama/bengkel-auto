import { z } from "zod";
import { toNumber } from "./common";

const num = (label: string, min: number, max: number, int = false) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: `${label} harus angka` })
      .min(min, `${label} minimal ${min}`)
      .max(max, `${label} maksimal ${max}`)
      .refine((v) => !int || Number.isInteger(v), `${label} harus bilangan bulat`),
  );

export const settingsSchema = z.object({
  discount_limit_cashier: num("Batas diskon Kasir", 0, 100),
  discount_limit_admin: num("Batas diskon Admin", 0, 100),
  opname_pin_threshold: num("Ambang selisih opname", 0, 9_999_999_999),
  sales_return_max_days: num("Batas hari retur", 0, 365, true),
  allow_negative_stock: z.boolean(),
  part_issue_require_scan: z.boolean(),
});
export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsValues = z.output<typeof settingsSchema>;

/** Pengaturan Tanya AI: penyedia aktif dan nama model. Kunci API tidak diisi di sini (lihat env server). */
export const AI_PROVIDER_VALUES = ["", "anthropic", "openai", "gemini", "openrouter"] as const;
const aiModel = z
  .string()
  .trim()
  .max(120, "Nama model maksimal 120 karakter")
  .regex(/^[A-Za-z0-9._/:-]*$/, "Nama model hanya huruf, angka, titik, garis miring, titik dua, atau minus");
export const aiSettingsSchema = z.object({
  ai_provider: z.enum(AI_PROVIDER_VALUES, { error: "Penyedia tidak dikenal" }),
  ai_model_anthropic: aiModel,
  ai_model_openai: aiModel,
  ai_model_gemini: aiModel,
  ai_model_openrouter: aiModel,
});
export type AiSettingsInput = z.input<typeof aiSettingsSchema>;
export type AiSettingsValues = z.output<typeof aiSettingsSchema>;
