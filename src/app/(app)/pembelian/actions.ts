"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  paymentSchema,
  poSchema,
  receiptSchema,
  returnSchema,
  supplierSchema,
  type PaymentInput,
  type PoInput,
  type ReceiptInput,
  type ReturnInput,
  type SupplierInput,
} from "@/lib/validation/purchasing";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "pembelian");
const refresh = () => {
  revalidatePath("/pembelian", "layout");
  revalidatePath("/inventory", "layout"); // stok & HPP berubah
};
const isUuid = (v: string) => z.uuid().safeParse(v).success;

export async function saveSupplierAction(id: string | null, input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_supplier", { p_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function setSupplierActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_supplier_active", { p_id: id, p_active: active });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function savePurchaseOrderAction(id: string | null, input: PoInput): Promise<ActionResult<{ id: string }>> {
  const parsed = poSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { items, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: poId, error } = await supabase.rpc("save_purchase_order", { p_id: id, p_data: data, p_items: items });
  if (error) return dbError(error);
  refresh();
  return done({ id: poId as string });
}

export async function setPurchaseOrderStatusAction(id: string, action: "send" | "close" | "cancel", reason?: string): Promise<ActionResult> {
  if (!isUuid(id) || !["send", "close", "cancel"].includes(action)) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_purchase_order_status", { p_id: id, p_action: action, p_reason: reason ?? null });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function postGoodsReceiptAction(input: ReceiptInput): Promise<ActionResult<{ id: string }>> {
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { items, pay_now, paid_amount, cash_bank_account_id, po_id, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: grId, error } = await supabase.rpc("post_goods_receipt", {
    p_data: {
      ...data,
      po_id: po_id || null,
      paid_amount: pay_now ? paid_amount : 0,
      cash_bank_account_id: pay_now ? cash_bank_account_id : null,
    },
    p_items: items.map((i) => ({ ...i, po_item_id: i.po_item_id || null })),
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: grId as string });
}

export async function postPurchaseReturnAction(receiptId: string, input: ReturnInput): Promise<ActionResult> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(receiptId)) return { ok: false, error: "Data tidak valid." };
  const { items, ...data } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_purchase_return", {
    p_receipt_id: receiptId,
    p_data: { ...data, cash_bank_account_id: data.settlement === "refund" ? data.cash_bank_account_id : null },
    p_items: items.filter((i) => i.base_qty > 0),
  });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function postSupplierPaymentAction(input: PaymentInput): Promise<ActionResult<{ id: string }>> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { allocations, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("post_supplier_payment", {
    p_data: data,
    p_allocations: allocations.filter((a) => a.amount > 0),
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: id as string });
}

export async function voidSupplierPaymentAction(id: string, reason: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Data tidak valid." };
  if (reason.trim().length < 3) return { ok: false, error: "Alasan pembatalan wajib diisi." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_supplier_payment", { p_id: id, p_reason: reason.trim() });
  if (error) return dbError(error);
  refresh();
  return done();
}
