"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  loanSchema,
  payPayrollSchema,
  payProfileSchema,
  periodSchema,
  reasonSchema,
  repaySchema,
  slipSchema,
  type LoanInput,
  type PayPayrollInput,
  type PayProfileInput,
  type PeriodInput,
  type RepayInput,
  type SlipInput,
} from "@/lib/validation/payroll";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "penggajian");
const refresh = () => {
  revalidatePath("/penggajian", "layout");
  revalidatePath("/keuangan", "layout");
};
const isUuid = (v: string) => z.uuid().safeParse(v).success;
const bad = { ok: false as const, error: "Data tidak valid." };

export async function savePayProfileAction(employeeId: string, input: PayProfileInput): Promise<ActionResult> {
  const parsed = payProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(employeeId)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_pay_profile", { p_employee_id: employeeId, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function createPeriodAction(input: PeriodInput): Promise<ActionResult<{ id: string }>> {
  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_payroll_period", { p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function updateSlipAction(id: string, input: SlipInput): Promise<ActionResult> {
  const parsed = slipSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_payslip", { p_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

async function simple(fn: "submit_payroll" | "reopen_payroll" | "approve_payroll", id: string): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_id: id });
  if (error) return dbError(error);
  refresh();
  return done();
}
export async function submitPayrollAction(id: string): Promise<ActionResult> {
  return simple("submit_payroll", id);
}
export async function reopenPayrollAction(id: string): Promise<ActionResult> {
  return simple("reopen_payroll", id);
}
export async function approvePayrollAction(id: string): Promise<ActionResult> {
  return simple("approve_payroll", id);
}

export async function payPayrollAction(id: string, input: PayPayrollInput): Promise<ActionResult> {
  const parsed = payPayrollSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_payroll", { p_id: id, p_cash_bank_account_id: parsed.data.cash_bank_account_id, p_date: parsed.data.pay_date });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidPayrollAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payroll", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function createLoanAction(input: LoanInput): Promise<ActionResult<{ id: string }>> {
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_employee_loan", { p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function repayLoanAction(id: string, input: RepayInput): Promise<ActionResult> {
  const parsed = repaySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("repay_employee_loan", { p_loan_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidLoanAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_employee_loan", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}
