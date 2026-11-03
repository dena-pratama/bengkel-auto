"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, type ActionResult } from "@/lib/action-result";
import { askAnalyst } from "@/lib/ai/chat";
import { runToolAsUser } from "@/lib/ai/run";
import { buildWeeklySummary } from "@/lib/ai/weekly";
import { addDays, todayWib } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "ai");

export async function createTokenAction(name: string): Promise<ActionResult<{ token: string }>> {
  const parsed = z.string().trim().min(2, "Nama token minimal 2 karakter").max(60, "Nama token maksimal 60 karakter").safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_ai_token", { p_name: parsed.data });
  if (error) return dbError(error);
  revalidatePath("/ai");
  return done({ token: data as string });
}

export async function revokeTokenAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_ai_token", { p_id: id });
  if (error) return dbError(error);
  revalidatePath("/ai");
  return done();
}

export async function generateWeeklyAction(): Promise<ActionResult> {
  const today = todayWib();
  const summary = await buildWeeklySummary(runToolAsUser, today, addDays(today, -6));
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_ai_insight", { p_payload: summary, p_score: summary.score });
  if (error) return dbError(error);
  revalidatePath("/ai");
  return done();
}

export async function askAction(question: string): Promise<ActionResult<{ answer: string; tools: string[] }>> {
  const parsed = z.string().trim().min(5, "Tulis pertanyaan minimal 5 karakter").max(500, "Pertanyaan maksimal 500 karakter").safeParse(question);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const res = await askAnalyst(parsed.data);
  revalidatePath("/ai");
  return res.ok ? done({ answer: res.answer, tools: res.tools }) : { ok: false, error: res.error };
}
