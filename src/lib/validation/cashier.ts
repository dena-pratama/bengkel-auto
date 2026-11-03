import { z } from "zod";
import { toNumber } from "./common";

const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);
const money = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).min(0, `${label} tidak boleh minus`).max(9_999_999_999_999, `${label} terlalu besar`));
const positive = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).gt(0, `${label} harus lebih dari 0`).max(9_999_999_999_999, `${label} terlalu besar`));

export const METHODS = ["cash", "transfer", "qris", "card"] as const;
export type PayMethod = (typeof METHODS)[number];
export const METHOD_LABEL: Record<PayMethod | "deposit", string> = {
  cash: "Tunai",
  transfer: "Transfer bank",
  qris: "QRIS",
  card: "Kartu debit/kredit (EDC)",
  deposit: "DP dipakai",
};

export const paymentLineSchema = z.object({
  method: z.enum(METHODS, { error: "Pilih metode bayar" }),
  amount: money("Jumlah bayar"),
  reference: text(60),
});
export type PaymentLineInput = z.input<typeof paymentLineSchema>;

export const paymentsSchema = z.object({
  payments: z.array(paymentLineSchema),
  pin: text(6),
});
export type PaymentsInput = z.input<typeof paymentsSchema>;

export const depositSchema = z.object({
  method: z.enum(METHODS, { error: "Pilih metode bayar" }),
  amount: positive("Jumlah DP"),
  reference: text(60),
});
export type DepositInput = z.input<typeof depositSchema>;

export const saleLineSchema = z.object({
  item_id: z.uuid("Pilih barang"),
  qty: positive("Jumlah"),
  discount_amount: money("Diskon"),
});
export const saleSchema = z.object({
  customer_id: z.string(),
  discount_amount: money("Diskon total"),
  notes: text(300),
  lines: z.array(saleLineSchema).min(1, "Tambahkan minimal satu barang"),
});
export type SaleInput = z.input<typeof saleSchema>;

export const openShiftSchema = z.object({ opening: money("Modal awal") });
export const cashOutSchema = z.object({
  account_id: z.uuid("Pilih kategori biaya"),
  amount: positive("Jumlah"),
  note: z.string().trim().min(3, "Keterangan wajib diisi").max(200),
});
export type CashOutInput = z.input<typeof cashOutSchema>;

export const DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100] as const;
export const closeShiftSchema = z.object({
  counts: z.array(z.object({ value: z.number(), qty: z.preprocess((v) => (String(v ?? "").trim() === "" ? 0 : toNumber(v)), z.number().int().min(0, "Jumlah lembar tidak boleh minus").max(100_000)) })),
  note: text(300),
});
export type CloseShiftInput = z.input<typeof closeShiftSchema>;

export const reasonSchema = z.string().trim().min(3, "Alasan wajib diisi").max(300);
