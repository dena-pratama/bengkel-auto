"use server";

import { revalidatePath } from "next/cache";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { markSchema, ruleSchema, type MarkInput, type RuleInput } from "@/lib/validation/reminders";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "reminder");

export async function saveRuleAction(input: RuleInput): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_reminder_rule", {
    p_service_id: v.service_id,
    p_interval_km: v.interval_km === "" ? null : Number(v.interval_km),
    p_interval_months: v.interval_months === "" ? null : Number(v.interval_months),
    p_active: v.is_active,
  });
  if (error) return dbError(error);
  revalidatePath("/pelanggan/reminder");
  return done();
}

export async function markReminderAction(input: MarkInput): Promise<ActionResult> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_service_reminder", { p_vehicle_id: v.vehicle_id, p_rule_id: v.rule_id, p_wo_id: v.wo_id, p_status: v.status });
  if (error) return dbError(error);
  revalidatePath("/pelanggan/reminder");
  return done();
}
