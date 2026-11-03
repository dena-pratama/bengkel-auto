import { z } from "zod";
import { toNumber } from "./common";

const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);
const phone = text(20).refine((v) => v === "" || /^(\+62|62|0)8[0-9]{7,12}$/.test(v.replace(/[\s().-]/g, "")), "Nomor HP/WhatsApp tidak valid (contoh 0812xxxxxxx)");
const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess((v) => (String(v ?? "").trim() === "" ? undefined : toNumber(v)), z.number({ error: `${label} harus angka` }).int().min(min).max(max).optional());

export const customerSchema = z.object({
  type: z.enum(["individual", "company"]),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  phone,
  email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Format email tidak valid"),
  address: text(300),
  npwp: text(30),
  credit_limit: z.preprocess(toNumber, z.number().min(0, "Tidak boleh minus").max(9_999_999_999_999)),
  payment_terms_days: z.preprocess(toNumber, z.number().int().min(0).max(365, "Maksimal 365 hari")),
  notes: text(500),
});
export type CustomerInput = z.input<typeof customerSchema>;

export const PLATE_PATTERN = /^[A-Z]{1,2}[0-9]{1,4}[A-Z]{0,3}$/;

export const vehicleSchema = z.object({
  plate_no: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => PLATE_PATTERN.test(v.replace(/[^A-Z0-9]/g, "")), "Nomor polisi tidak valid (contoh B 1234 KJT)"),
  make: text(40),
  model: text(60),
  variant: text(60),
  year: optionalInt("Tahun", 1950, 2100),
  color: text(30),
  transmission: z.enum(["", "manual", "automatic", "cvt", "other"]),
  fuel: z.enum(["", "gasoline", "diesel", "hybrid", "electric", "other"]),
  vin: text(30),
  engine_no: text(30),
  last_odometer: optionalInt("Kilometer", 0, 9_999_999),
  notes: text(500),
  owner_id: z.string(),
});
export type VehicleInput = z.input<typeof vehicleSchema>;

export const transferSchema = z.object({
  customer_id: z.uuid("Pilih pemilik baru"),
  date: z.string().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid"),
  note: text(200),
});
export type TransferInput = z.input<typeof transferSchema>;

export const CUSTOMER_TYPE_LABEL = { individual: "Perorangan", company: "Perusahaan / Fleet" } as const;
export const TRANSMISSION_LABEL = { manual: "Manual", automatic: "Otomatis (AT)", cvt: "CVT", other: "Lainnya" } as const;
export const FUEL_LABEL = { gasoline: "Bensin", diesel: "Diesel / Solar", hybrid: "Hybrid", electric: "Listrik", other: "Lainnya" } as const;

/** Tampilan plat: "B1234KJT" → "B 1234 KJT" (sama dengan normalisasi di database) */
export function formatPlate(raw: string) {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = v.match(/^([A-Z]{1,2})([0-9]{1,4})([A-Z]{0,3})$/);
  return m ? [m[1], m[2], m[3]].filter(Boolean).join(" ") : raw.toUpperCase();
}
