"use server";

import { revalidatePath } from "next/cache";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { aiSettingsSchema, settingsSchema, type AiSettingsInput, type SettingsInput } from "@/lib/validation/settings";

export async function saveSettingsAction(input: SettingsInput): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_settings", { p_data: parsed.data });
  if (error) return toDbError(error, "pengaturan");
  revalidatePath("/pengaturan");
  return done();
}

export async function saveAiSettingsAction(input: AiSettingsInput): Promise<ActionResult> {
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_settings", { p_data: parsed.data });
  if (error) return toDbError(error, "pengaturan");
  revalidatePath("/pengaturan");
  revalidatePath("/ai");
  return done();
}
