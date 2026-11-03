"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { toNumber } from "@/lib/validation/common";
import {
  accountSchema,
  cashBankSchema,
  cashTxnSchema,
  confirmRecurringSchema,
  manualJournalSchema,
  reasonSchema,
  recurringSchema,
  type AccountInput,
  type CashBankInput,
  type CashTxnInput,
  type ConfirmRecurringInput,
  type ManualJournalInput,
  type RecurringInput,
} from "@/lib/validation/finance";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "keuangan");
const refresh = () => revalidatePath("/keuangan", "layout");
const isUuid = (v: string) => z.uuid().safeParse(v).success;
const bad = { ok: false as const, error: "Data tidak valid." };

export async function postCashTxnAction(input: CashTxnInput): Promise<ActionResult<{ id: string }>> {
  const parsed = cashTxnSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_cash_transaction", {
    p_data: {
      kind: v.kind,
      txn_date: v.txn_date,
      cash_bank_account_id: v.cash_bank_account_id,
      to_cash_bank_account_id: v.to_cash_bank_account_id,
      account_id: v.account_id,
      amount: v.amount,
      description: v.description,
    },
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function voidCashTxnAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_cash_transaction", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function saveRecurringAction(id: string | null, input: RecurringInput): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (id && !isUuid(id)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_recurring_expense", { p_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function setRecurringActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_recurring_expense_active", { p_id: id, p_active: active });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function confirmRecurringAction(id: string, input: ConfirmRecurringInput): Promise<ActionResult> {
  const parsed = confirmRecurringSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_recurring_expense", { p_id: id, p_date: parsed.data.date, p_amount: parsed.data.amount });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function postManualJournalAction(input: ManualJournalInput): Promise<ActionResult<{ id: string }>> {
  const parsed = manualJournalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const lines = parsed.data.lines
    .map((l) => ({ account_id: l.account_id, debit: toNumber(l.debit), credit: toNumber(l.credit), memo: l.memo || null }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  if (lines.some((l) => !isUuid(l.account_id))) return { ok: false, error: "Pilih akun di setiap baris." };
  if (lines.some((l) => l.debit > 0 && l.credit > 0)) return { ok: false, error: "Satu baris hanya boleh debit atau kredit." };
  const debit = lines.reduce((t, l) => t + l.debit, 0);
  const credit = lines.reduce((t, l) => t + l.credit, 0);
  if (Math.abs(debit - credit) > 0.004) return { ok: false, error: "Jurnal tidak seimbang: total debit harus sama dengan total kredit." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_manual_journal", { p_date: parsed.data.date, p_description: parsed.data.description, p_lines: lines });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function reverseManualJournalAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_manual_journal", { p_entry_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function saveAccountAction(id: string | null, input: AccountInput): Promise<ActionResult<{ id: string }>> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (id && !isUuid(id)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_account", { p_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function setAccountActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_account_active", { p_id: id, p_active: active });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function saveCashBankAction(id: string | null, input: CashBankInput): Promise<ActionResult<{ id: string }>> {
  const parsed = cashBankSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (id && !isUuid(id)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_cash_bank_account", { p_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function closePeriodAction(year: number, month: number): Promise<ActionResult> {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_fiscal_period", { p_year: year, p_month: month });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function reopenPeriodAction(year: number, month: number, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_fiscal_period", { p_year: year, p_month: month, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}
