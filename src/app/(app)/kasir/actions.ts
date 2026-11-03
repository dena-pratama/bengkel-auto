"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  DENOMINATIONS,
  cashOutSchema,
  closeShiftSchema,
  depositSchema,
  openShiftSchema,
  paymentsSchema,
  reasonSchema,
  saleReturnSchema,
  saleSchema,
  type CashOutInput,
  type CloseShiftInput,
  type DepositInput,
  type PaymentsInput,
  type SaleInput,
  type SaleReturnInput,
} from "@/lib/validation/cashier";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "kasir");
const refresh = () => {
  revalidatePath("/kasir", "layout");
  revalidatePath("/servis", "layout");
  revalidatePath("/inventory", "layout");
};
const isUuid = (v: string) => z.uuid().safeParse(v).success;
const bad = { ok: false as const, error: "Data tidak valid." };

/** Baris bayar form -> format fungsi database (baris kosong dibuang) */
const toPayments = (p: PaymentsInput) =>
  paymentsSchema.safeParse(p).success
    ? paymentsSchema.parse(p).payments.filter((l) => l.amount > 0).map((l) => ({ method: l.method, amount: l.amount, reference: l.reference }))
    : [];

// ---------------------------------------------------------------------------- Shift

export async function openShiftAction(input: { opening: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = openShiftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_shift", { p_opening: parsed.data.opening });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function addCashOutAction(input: CashOutInput): Promise<ActionResult> {
  const parsed = cashOutSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_cash_out", { p_account_id: parsed.data.account_id, p_amount: parsed.data.amount, p_note: parsed.data.note });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function closeShiftAction(input: CloseShiftInput): Promise<ActionResult<{ id: string }>> {
  const parsed = closeShiftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const counts = parsed.data.counts.filter((c) => c.qty > 0 && (DENOMINATIONS as readonly number[]).includes(c.value));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_shift", { p_counted: 0, p_denominations: counts, p_note: parsed.data.note || null });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function approveShiftAction(id: string, note: string): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_shift", { p_id: id, p_note: note.trim() || null });
  if (error) return dbError(error);
  refresh();
  return done();
}

// ---------------------------------------------------------------------------- Penjualan

export async function saveSaleAction(id: string | null, input: SaleInput): Promise<ActionResult<{ id: string }>> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (id && !isUuid(id)) return bad;
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_sale", {
    p_id: id,
    p_data: { customer_id: v.customer_id, discount_amount: v.discount_amount, notes: v.notes },
    p_items: v.lines,
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

/** Simpan lalu posting dalam satu langkah dari layar kasir; jika posting gagal, draft tetap tersimpan. */
export async function saveAndPostSaleAction(
  id: string | null,
  input: SaleInput,
  pay: PaymentsInput,
): Promise<ActionResult<{ id: string; posted: boolean }>> {
  const saved = await saveSaleAction(id, input);
  if (!saved.ok) return saved;
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_sale", { p_id: saved.data.id, p_payments: toPayments(pay), p_pin: pay.pin || null });
  if (error) {
    const e = dbError(error);
    return { ok: false, error: `${e.error} (transaksi tersimpan sebagai draft)` };
  }
  refresh();
  return done({ id: saved.data.id, posted: true });
}

export async function postSaleAction(id: string, pay: PaymentsInput): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_sale", { p_id: id, p_payments: toPayments(pay), p_pin: pay.pin || null });
  if (error) return dbError(error);
  refresh();
  return done({ id });
}

export async function invoiceWorkOrderAction(woId: string, pay: PaymentsInput): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(woId)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_work_order_invoice", { p_wo_id: woId, p_payments: toPayments(pay), p_pin: pay.pin || null, p_data: {} });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

/** Total invoice WO termasuk PPN (pratinjau, tidak menyimpan) */
export async function previewInvoiceAction(woId: string): Promise<ActionResult<{ total: number }>> {
  if (!isUuid(woId)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_work_order_invoice", { p_wo_id: woId });
  if (error) return dbError(error);
  return done({ total: Number(data) });
}

/** Total draft penjualan hasil hitung server (termasuk PPN) */
export async function saleTotalAction(id: string): Promise<ActionResult<{ total: number }>> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_sales").select("total").eq("id", id).maybeSingle();
  if (error) return dbError(error as Parameters<typeof toDbError>[0]);
  if (!data) return { ok: false, error: "Transaksi tidak ditemukan." };
  return done({ total: Number(data.total) });
}

export async function paySaleAction(id: string, pay: PaymentsInput): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const payments = toPayments(pay);
  if (payments.length === 0) return { ok: false, error: "Isi jumlah bayar minimal satu metode." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_sale", { p_sale_id: id, p_payments: payments, p_pin: pay.pin || null });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function recordDepositAction(woId: string, input: DepositInput): Promise<ActionResult> {
  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(woId)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_deposit", { p_wo_id: woId, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidPaymentAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidSaleAction(id: string, reason: string, pin: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_id: id, p_reason: parsed.data, p_pin: pin.trim() || null });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function postSaleReturnAction(
  saleId: string,
  input: SaleReturnInput,
): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(saleId)) return bad;
  const parsed = saleReturnSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_sale_return", {
    p_sale_id: saleId,
    p_data: {
      return_date: parsed.data.return_date,
      settlement: parsed.data.settlement,
      payment_method: parsed.data.payment_method || null,
      cash_bank_account_id: parsed.data.cash_bank_account_id || null,
      reason: parsed.data.reason,
    },
    p_items: parsed.data.items,
    p_pin: parsed.data.pin || null,
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}
