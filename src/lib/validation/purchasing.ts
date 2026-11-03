import { z } from "zod";
import { toNumber } from "./common";

const money = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).min(0, `${label} tidak boleh minus`).max(9_999_999_999_999, `${label} terlalu besar`));
const positive = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).gt(0, `${label} harus lebih dari 0`).max(99_999_999_999, `${label} terlalu besar`));
const optionalDate = z.string().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid");
const optionalText = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  contact_name: optionalText(80),
  phone: optionalText(30),
  email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Format email tidak valid"),
  address: optionalText(300),
  npwp: optionalText(30),
  payment_terms_days: z.preprocess(toNumber, z.number().int().min(0).max(365, "Maksimal 365 hari")),
  bank_name: optionalText(50),
  bank_account_number: optionalText(30),
  bank_account_name: optionalText(80),
  notes: optionalText(500),
});
export type SupplierInput = z.input<typeof supplierSchema>;

export const poSchema = z.object({
  supplier_id: z.uuid("Pilih supplier"),
  order_date: optionalDate,
  expected_date: optionalDate,
  notes: optionalText(500),
  items: z
    .array(z.object({ item_id: z.uuid("Pilih barang"), unit_id: z.uuid("Pilih satuan"), qty: positive("Jumlah"), unit_price: money("Harga") }))
    .min(1, "Tambahkan minimal satu barang"),
});
export type PoInput = z.input<typeof poSchema>;

export const receiptSchema = z
  .object({
    supplier_id: z.uuid("Pilih supplier"),
    po_id: z.string(),
    receipt_date: optionalDate,
    invoice_no: optionalText(60),
    invoice_date: optionalDate,
    due_date: optionalDate,
    ppn_amount: money("PPN"),
    notes: optionalText(500),
    pay_now: z.boolean(),
    paid_amount: money("Jumlah bayar"),
    cash_bank_account_id: z.string(),
    items: z
      .array(
        z.object({
          item_id: z.uuid("Pilih barang"),
          unit_id: z.uuid("Pilih satuan"),
          qty: positive("Jumlah"),
          unit_price: money("Harga"),
          discount_amount: money("Diskon"),
          location_id: z.uuid("Pilih lokasi rak"),
          po_item_id: z.string(),
        }),
      )
      .min(1, "Tambahkan minimal satu barang"),
  })
  .refine((v) => !v.pay_now || z.uuid().safeParse(v.cash_bank_account_id).success, {
    path: ["cash_bank_account_id"],
    message: "Pilih akun kas/bank",
  });
export type ReceiptInput = z.input<typeof receiptSchema>;

export const returnSchema = z
  .object({
    return_date: optionalDate,
    settlement: z.enum(["debt", "refund"]),
    cash_bank_account_id: z.string(),
    reason: z.string().trim().min(3, "Alasan retur wajib diisi").max(300),
    items: z.array(z.object({ receipt_item_id: z.uuid(), base_qty: z.preprocess(toNumber, z.number().min(0)) })),
  })
  .refine((v) => v.items.some((i) => i.base_qty > 0), { path: ["items"], message: "Isi jumlah retur minimal satu barang" })
  .refine((v) => v.settlement === "debt" || z.uuid().safeParse(v.cash_bank_account_id).success, {
    path: ["cash_bank_account_id"],
    message: "Pilih akun kas/bank penerima uang kembali",
  });
export type ReturnInput = z.input<typeof returnSchema>;

export const paymentSchema = z.object({
  supplier_id: z.uuid("Pilih supplier"),
  payment_date: optionalDate,
  cash_bank_account_id: z.uuid("Pilih akun kas/bank"),
  notes: optionalText(300),
  allocations: z
    .array(z.object({ receipt_id: z.uuid(), amount: z.preprocess(toNumber, z.number().min(0)) }))
    .refine((a) => a.some((x) => x.amount > 0), "Isi jumlah bayar minimal satu faktur"),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const PO_STATUS_LABEL = {
  draft: "Draft",
  sent: "Dikirim",
  partial: "Diterima sebagian",
  received: "Diterima penuh",
  closed: "Ditutup",
  cancelled: "Dibatalkan",
} as const;

export const TERMS_OPTIONS = [
  { value: "0", label: "Tunai" },
  { value: "7", label: "7 hari" },
  { value: "14", label: "14 hari" },
  { value: "30", label: "30 hari" },
];
