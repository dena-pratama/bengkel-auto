import { z } from "zod";

const year = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= 2100), "Tahun harus 4 digit antara 1950 dan 2100");

export const compatRowSchema = z
  .object({
    make: z.string().trim().min(1, "Merek wajib diisi").max(40, "Merek maksimal 40 karakter"),
    model: z.string().trim().min(1, "Model wajib diisi").max(60, "Model maksimal 60 karakter"),
    year_from: year,
    year_to: year,
    engine: z.string().trim().max(60, "Mesin maksimal 60 karakter"),
  })
  .refine((v) => v.year_from === "" || v.year_to === "" || Number(v.year_to) >= Number(v.year_from), { message: "Tahun akhir tidak boleh sebelum tahun awal", path: ["year_to"] });

export const compatListSchema = z.array(compatRowSchema).max(200, "Maksimal 200 kendaraan per barang");
export type CompatRowInput = z.input<typeof compatRowSchema>;
