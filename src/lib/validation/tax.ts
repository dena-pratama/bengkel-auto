import { z } from "zod";
import { toNumber } from "./common";

const num = (label: string, min: number, max: number) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).min(min, `${label} minimal ${min}`).max(max, `${label} maksimal ${max}`));

export const BUSINESS_FORMS = ["orang_pribadi", "pt_perorangan", "koperasi", "cv_firma_pt"] as const;
export const BUSINESS_FORM_LABEL = {
  orang_pribadi: "Orang Pribadi",
  pt_perorangan: "PT Perorangan",
  koperasi: "Koperasi",
  cv_firma_pt: "CV / Firma / PT",
} as const;
export const PPH_MODES = ["off", "final", "general"] as const;
export const PPH_MODE_LABEL = { off: "Tidak dihitung", final: "PPh Final UMKM", general: "Estimasi PPh tarif umum" } as const;

export const taxSettingsSchema = z
  .object({
    business_form: z.enum(BUSINESS_FORMS),
    is_pkp: z.boolean(),
    ppn_enabled: z.boolean(),
    prices_include_ppn: z.boolean(),
    pph_mode: z.enum(PPH_MODES),
    pph_final_rate: num("Tarif PPh Final", 0, 100),
    general_rate: num("Tarif umum", 0, 100),
    annual_ceiling: num("Batas omzet", 1, 99_999_999_999_999),
    free_threshold: num("Omzet bebas pajak", 0, 99_999_999_999_999),
    facility_end_date: z.string(),
    pph_due_day: num("Tanggal setor", 1, 28),
  })
  .refine((v) => !v.ppn_enabled || v.is_pkp, { path: ["ppn_enabled"], message: "PPN hanya bisa diaktifkan jika bengkel berstatus PKP" })
  .refine((v) => !(v.pph_mode === "final" && v.business_form === "cv_firma_pt") || v.facility_end_date !== "", {
    path: ["facility_end_date"],
    message: "CV/Firma/PT wajib mengisi tanggal akhir fasilitas PPh Final",
  });
export type TaxSettingsInput = z.input<typeof taxSettingsSchema>;

export const taxRateSchema = z.object({
  rate_percent: num("Tarif", 0, 100),
  dpp_numerator: num("Pembilang DPP", 1, 1000),
  dpp_denominator: num("Penyebut DPP", 1, 1000),
  valid_from: z.string().min(1, "Tanggal berlaku wajib diisi"),
});
export type TaxRateInput = z.input<typeof taxRateSchema>;

export const taxPaymentSchema = z.object({
  tax_type: z.enum(["pph_final", "ppn"]),
  period_year: z.string(),
  period_month: z.string(),
  amount: z.preprocess(toNumber, z.number({ error: "Jumlah harus angka" }).gt(0, "Jumlah harus lebih dari 0").max(9_999_999_999_999)),
  pay_date: z.string().min(1, "Tanggal wajib diisi"),
  cash_bank_account_id: z.uuid("Pilih akun kas/bank"),
  reference: z.string().trim().max(60),
});
export type TaxPaymentInput = z.input<typeof taxPaymentSchema>;

export const reasonSchema = z.string().trim().min(3, "Alasan wajib diisi").max(300);
