import { z } from "zod";
import { toNumber } from "./common";

const money = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).min(0, `${label} tidak boleh minus`).max(9_999_999_999_999, `${label} terlalu besar`));
const positive = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).gt(0, `${label} harus lebih dari 0`).max(9_999_999_999_999, `${label} terlalu besar`));
const date = (label: string) => z.string().min(1, `${label} wajib diisi`).refine((v) => !Number.isNaN(Date.parse(v)), `${label} tidak valid`);

export const payProfileSchema = z.object({
  pay_type: z.enum(["monthly", "daily"]),
  base_salary: money("Gaji pokok"),
  fixed_allowances: z.array(z.object({ name: z.string().trim().min(2, "Nama tunjangan minimal 2 karakter").max(40), amount: money("Jumlah tunjangan") })),
});
export type PayProfileInput = z.input<typeof payProfileSchema>;

export const periodSchema = z
  .object({
    period_type: z.enum(["monthly", "weekly"]),
    start_date: date("Tanggal mulai"),
    end_date: date("Tanggal selesai"),
    label: z.string().trim().max(60),
  })
  .refine((v) => v.end_date >= v.start_date, { path: ["end_date"], message: "Tanggal selesai tidak boleh sebelum mulai" });
export type PeriodInput = z.input<typeof periodSchema>;

export const slipSchema = z.object({
  days_worked: money("Hari masuk"),
  overtime_hours: money("Jam lembur"),
  overtime_rate: money("Tarif lembur"),
  bonus_amount: money("Bonus"),
  other_deduction: money("Potongan lain"),
  other_deduction_note: z.string().trim().max(120),
  loan_deduction: money("Potongan kasbon"),
  notes: z.string().trim().max(200),
});
export type SlipInput = z.input<typeof slipSchema>;

export const loanSchema = z
  .object({
    employee_id: z.uuid("Pilih karyawan"),
    loan_date: date("Tanggal"),
    principal: positive("Jumlah kasbon"),
    installment_amount: positive("Cicilan"),
    cash_bank_account_id: z.uuid("Pilih akun kas/bank"),
    note: z.string().trim().max(200),
  })
  .refine((v) => Number(v.installment_amount) <= Number(v.principal), { path: ["installment_amount"], message: "Cicilan tidak boleh melebihi kasbon" });
export type LoanInput = z.input<typeof loanSchema>;

export const repaySchema = z.object({
  amount: positive("Jumlah"),
  pay_date: date("Tanggal"),
  cash_bank_account_id: z.uuid("Pilih akun kas/bank"),
});
export type RepayInput = z.input<typeof repaySchema>;

export const payPayrollSchema = z.object({ cash_bank_account_id: z.uuid("Pilih akun kas/bank"), pay_date: date("Tanggal bayar") });
export type PayPayrollInput = z.input<typeof payPayrollSchema>;

export const reasonSchema = z.string().trim().min(3, "Alasan wajib diisi").max(300);

export const STATUS_LABEL = { draft: "Draft", review: "Review Owner", approved: "Disetujui", paid: "Dibayar", void: "Dibatalkan" } as const;
export const COMMISSION_LABEL = { pending: "Menunggu lunas", recognized: "Diakui, belum dibayar", paid: "Sudah dibayar", void: "Batal" } as const;
