import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

function unwrap(data: unknown, error: { message: string } | null): ToolResult {
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) return { ok: false, error: String((data as { error: unknown }).error) };
  return { ok: true, data };
}

/** Jalankan tool sebagai pengguna yang sedang login (halaman /ai). */
export async function runToolAsUser(tool: string, params: Record<string, unknown> = {}): Promise<ToolResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ai_run_tool", { p_tool: tool, p_params: params });
  return unwrap(data, error);
}

/** Jalankan tool dengan token pribadi (server MCP dan penjadwal). Hash token dicek di database. */
export async function runToolWithToken(token: string, tool: string, params: Record<string, unknown> = {}): Promise<ToolResult> {
  const { data, error } = await createAdminClient().rpc("ai_run_tool_token", { p_token: token, p_tool: tool, p_params: params });
  return unwrap(data, error);
}

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+(abk_[0-9a-f]{48})$/i.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}
