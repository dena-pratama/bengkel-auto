import { z } from "zod";
import { toNumber } from "./common";

const money = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).min(0, `${label} tidak boleh minus`).max(9_999_999_999_999, `${label} terlalu besar`));
const quantity = (label: string, min = 0) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).min(min, `${label} minimal ${min}`).max(99_999_999_999, `${label} terlalu besar`));
const wholeDays = z.preprocess(toNumber, z.number().int("Harus bilangan bulat").min(0).max(3650, "Maksimal 3650 hari"));
const optionalId = z.string().refine((v) => v === "" || z.uuid().safeParse(v).success, "Pilihan tidak valid");

export const itemSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z0-9][A-Z0-9-]{1,29}$/.test(v), "SKU hanya huruf, angka, dan tanda minus (2-30)"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Maksimal 120 karakter"),
  category_id: optionalId,
  brand_id: optionalId,
  base_unit_id: z.uuid("Satuan dasar wajib dipilih"),
  sell_price: money("Harga jual"),
  min_stock: quantity("Stok minimum"),
  default_location_id: optionalId,
  warranty_days: wholeDays,
  is_taxable: z.boolean(),
  notes: z.string().trim().max(500, "Maksimal 500 karakter"),
  units: z.array(
    z.object({
      unit_id: z.uuid("Pilih satuan"),
      factor: quantity("Faktor", 0.001),
      is_purchase: z.boolean(),
      is_sale: z.boolean(),
    }),
  ),
  part_numbers: z.array(
    z.object({ part_number: z.string().trim().min(2, "Part number minimal 2 karakter").max(40), is_oem: z.boolean() }),
  ),
});
export type ItemInput = z.input<typeof itemSchema>;
export type ItemData = z.output<typeof itemSchema>;

export const serviceSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z0-9][A-Z0-9-]{1,19}$/.test(v), "Kode hanya huruf, angka, dan tanda minus"),
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
    category_id: optionalId,
    price: money("Harga jasa"),
    duration_minutes: z.preprocess(toNumber, z.number().int().min(0).max(10080, "Maksimal 7 hari")),
    commission_type: z.enum(["percent", "fixed"]),
    commission_value: money("Komisi"),
    warranty_days: wholeDays,
    is_taxable: z.boolean(),
  })
  .refine((v) => v.commission_type !== "percent" || v.commission_value <= 100, {
    path: ["commission_value"],
    message: "Komisi persen maksimal 100",
  });
export type ServiceInput = z.input<typeof serviceSchema>;

export const packageSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z0-9][A-Z0-9-]{1,19}$/.test(v), "Kode hanya huruf, angka, dan tanda minus"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  description: z.string().trim().max(300),
  price: money("Harga paket"),
  items: z
    .array(
      z.object({
        kind: z.enum(["item", "service"]),
        id: z.uuid(),
        qty: quantity("Jumlah", 0.001),
      }),
    )
    .min(1, "Tambahkan minimal satu komponen"),
});
export type PackageInput = z.input<typeof packageSchema>;

export const openingStockSchema = z.object({
  location_id: z.uuid("Pilih lokasi"),
  qty: quantity("Jumlah", 0.001),
  unit_cost: money("Harga pokok"),
  note: z.string().trim().max(200),
});
export type OpeningStockInput = z.input<typeof openingStockSchema>;

export const transferSchema = z
  .object({
    from: z.uuid("Pilih lokasi asal"),
    to: z.uuid("Pilih lokasi tujuan"),
    qty: quantity("Jumlah", 0.001),
    note: z.string().trim().max(200),
  })
  .refine((v) => v.from !== v.to, { path: ["to"], message: "Lokasi tujuan harus berbeda" });
export type TransferInput = z.input<typeof transferSchema>;

export const MOVEMENT_LABEL: Record<string, string> = {
  opening: "Saldo awal",
  purchase: "Pembelian",
  sales_return: "Retur penjualan",
  sale: "Penjualan",
  service_usage: "Pemakaian servis",
  purchase_return: "Retur pembelian",
  opname_adjustment: "Penyesuaian opname",
  transfer_out: "Pindah lokasi (keluar)",
  transfer_in: "Pindah lokasi (masuk)",
};

export const LOCATION_TYPE_LABEL = { area: "Area", rack: "Rak", bin: "Level/Bin" } as const;
