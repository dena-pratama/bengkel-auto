import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { WeeklySummary } from "@/lib/ai/weekly";

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}

export type AiToken = { id: string; name: string; token_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string };
export type AiCall = { id: string; tool: string; params: Record<string, unknown>; source: "app" | "mcp"; ok: boolean; error: string | null; duration_ms: number | null; created_at: string; employee_name: string | null };
export type AiInsight = { id: string; score: number | null; created_at: string; payload: WeeklySummary };

export async function listAiTokens(): Promise<AiToken[]> {
  const s = await createClient();
  return must<AiToken[]>(await s.from("ai_tokens").select("id, name, token_prefix, last_used_at, revoked_at, created_at").order("created_at", { ascending: false }), "token AI");
}

export async function listAiCalls(limit = 30): Promise<AiCall[]> {
  const s = await createClient();
  type Row = Omit<AiCall, "employee_name"> & { employees: { full_name: string } | null };
  const rows = must<Row[]>(
    await s.from("ai_tool_calls").select("id, tool, params, source, ok, error, duration_ms, created_at, employees(full_name)").order("created_at", { ascending: false }).limit(limit),
    "log panggilan AI",
  );
  return rows.map(({ employees, ...r }) => ({ ...r, employee_name: employees?.full_name ?? null }));
}

export async function latestAiInsight(): Promise<AiInsight | null> {
  const s = await createClient();
  const rows = must<AiInsight[]>(await s.from("ai_insights").select("id, score, created_at, payload").eq("kind", "weekly").order("created_at", { ascending: false }).limit(1), "ringkasan mingguan");
  return rows[0] ?? null;
}
