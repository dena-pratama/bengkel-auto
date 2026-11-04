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
