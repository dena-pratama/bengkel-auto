import { z } from "zod";
import { toNumber } from "./common";

const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);
const positive = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).gt(0, `${label} harus lebih dari 0`).max(9_999_999_999_999, `${label} terlalu besar`));
const date = (label: string) => z.string().min(1, `${label} wajib diisi`).refine((v) => !Number.isNaN(Date.parse(v)), `${label} tidak valid`);

export const TXN_KINDS = ["expense", "income", "transfer", "capital", "drawing"] as const;
export type TxnKind = (typeof TXN_KINDS)[number];
export const TXN_KIND_LABEL: Record<TxnKind, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan lain",
  transfer: "Transfer antar akun",
  capital: "Setoran modal",
  drawing: "Prive",
};

export const cashTxnSchema = z
  .object({
    kind: z.enum(TXN_KINDS),
    txn_date: date("Tanggal"),
    cash_bank_account_id: z.uuid("Pilih akun kas/bank"),
    to_cash_bank_account_id: z.string(),
    account_id: z.string(),
    amount: positive("Jumlah"),
    description: z.string().trim().min(3, "Keterangan minimal 3 karakter").max(200),
  })
  .refine((v) => v.kind !== "transfer" || z.uuid().safeParse(v.to_cash_bank_account_id).success, { path: ["to_cash_bank_account_id"], message: "Pilih akun tujuan" })
  .refine((v) => v.kind !== "transfer" || v.to_cash_bank_account_id !== v.cash_bank_account_id, { path: ["to_cash_bank_account_id"], message: "Akun asal dan tujuan tidak boleh sama" })
  .refine((v) => !["expense", "income"].includes(v.kind) || z.uuid().safeParse(v.account_id).success, {
    path: ["account_id"],
    message: "Pilih kategori",
  });
export type CashTxnInput = z.input<typeof cashTxnSchema>;

export const recurringSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  account_id: z.uuid("Pilih akun beban"),
  cash_bank_account_id: z.uuid("Pilih akun kas/bank"),
  amount: positive("Jumlah"),
  day_of_month: z.preprocess(toNumber, z.number().int().min(1, "Tanggal 1-28").max(28, "Tanggal 1-28")),
});
export type RecurringInput = z.input<typeof recurringSchema>;

export const confirmRecurringSchema = z.object({ date: date("Tanggal"), amount: positive("Jumlah") });
export type ConfirmRecurringInput = z.input<typeof confirmRecurringSchema>;

const journalLine = z.object({
  account_id: z.string(),
  debit: z.string(),
  credit: z.string(),
  memo: text(120),
});
export const manualJournalSchema = z.object({
  date: date("Tanggal"),
  description: z.string().trim().min(3, "Keterangan minimal 3 karakter").max(200),
  lines: z.array(journalLine).min(2, "Minimal dua baris"),
});
export type ManualJournalInput = z.input<typeof manualJournalSchema>;
export type JournalLineInput = z.input<typeof journalLine>;

export const accountSchema = z.object({
  code: z.string().trim().regex(/^[1-7]-[0-9]{4}$/, "Kode berformat 6-1234"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  type: z.enum(["asset", "liability", "equity", "revenue", "cogs", "expense", "other"]),
});
export type AccountInput = z.input<typeof accountSchema>;

export const cashBankSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60),
  kind: z.enum(["cash", "bank"]),
  bank_name: text(60),
  account_number: text(40),
});
export type CashBankInput = z.input<typeof cashBankSchema>;

export const reasonSchema = z.string().trim().min(3, "Alasan wajib diisi").max(300);

export const ACCOUNT_TYPE_LABEL = {
  asset: "Aset",
  liability: "Kewajiban",
  equity: "Modal",
  revenue: "Pendapatan",
  cogs: "HPP",
  expense: "Beban usaha",
  other: "Lain-lain",
} as const;
export const ACCOUNT_CODE_PREFIX = { asset: "1", liability: "2", equity: "3", revenue: "4", cogs: "5", expense: "6", other: "7" } as const;

export const SOURCE_LABEL: Record<string, string> = {
  goods_receipt: "Penerimaan barang",
  supplier_payment: "Bayar hutang",
  purchase_return: "Retur ke supplier",
  part_issue: "Part keluar WO",
  sale: "Penjualan / invoice",
  payment: "Pembayaran",
  cash_out: "Kas keluar shift",
  shift_variance: "Selisih kas",
  cash_txn: "Transaksi kas",
  manual: "Jurnal manual",
  sale_return: "Retur penjualan",
  stock_opname: "Stok opname",
};
