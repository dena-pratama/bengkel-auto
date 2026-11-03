"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { reasonSchema, taxPaymentSchema, taxRateSchema, taxSettingsSchema, type TaxPaymentInput, type TaxRateInput, type TaxSettingsInput } from "@/lib/validation/tax";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "pajak");
const refresh = () => {
  revalidatePath("/pajak", "layout");
  revalidatePath("/keuangan", "layout");
  revalidatePath("/kasir", "layout");
};
const isUuid = (v: string) => z.uuid().safeParse(v).success;
const bad = { ok: false as const, error: "Data tidak valid." };

export async function saveTaxSettingsAction(input: TaxSettingsInput): Promise<ActionResult> {
  const parsed = taxSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_tax_settings", { p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function addTaxRateAction(input: TaxRateInput): Promise<ActionResult> {
  const parsed = taxRateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_tax_rate", { p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function postPphFinalAction(year: number, month: number): Promise<ActionResult> {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_pph_final", { p_year: year, p_month: month });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidPphFinalAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_pph_final", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function postTaxPaymentAction(input: TaxPaymentInput): Promise<ActionResult> {
  const parsed = taxPaymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_tax_payment", { p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidTaxPaymentAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_tax_payment", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}
