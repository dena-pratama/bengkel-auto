import "server-only";
import { AI_SYSTEM_PROMPT, AI_TOOLS } from "@/lib/ai/tools";
import { runToolAsUser } from "@/lib/ai/run";

// "Tanya AI" di aplikasi: model bahasa memanggil tool read-only yang sama dengan server MCP.
// Perlu ANTHROPIC_API_KEY di environment server. Tanpa kunci, fitur ini mati dan halaman memberi tahu.

const API = "https://api.anthropic.com/v1/messages";
const MAX_STEPS = 6;

type Block = { type: string; [k: string]: unknown };
type Msg = { role: "user" | "assistant"; content: string | Block[] };

export const aiChatConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function askAnalyst(question: string): Promise<{ ok: true; answer: string; tools: string[] } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Fitur Tanya AI belum aktif: ANTHROPIC_API_KEY belum diisi di server." };
  const model = process.env.AI_MODEL || "claude-sonnet-5-5";
  const messages: Msg[] = [{ role: "user", content: question }];
  const used: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: `${AI_SYSTEM_PROMPT} Hari ini ${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date())}.`,
        tools: AI_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
        messages,
      }),
    });
    if (!res.ok) {
      console.error("[ai/chat]", res.status, (await res.text()).slice(0, 300));
      return { ok: false, error: res.status === 401 ? "ANTHROPIC_API_KEY ditolak. Periksa kunci di environment server." : "Layanan AI sedang tidak bisa dihubungi. Coba lagi." };
    }
    const body = (await res.json()) as { content: Block[]; stop_reason: string };
    const calls = body.content.filter((b) => b.type === "tool_use");
    if (body.stop_reason !== "tool_use" || calls.length === 0) {
      const text = body.content.filter((b) => b.type === "text").map((b) => String(b.text)).join("\n").trim();
      return { ok: true, answer: text || "AI tidak memberi jawaban.", tools: used };
    }
    messages.push({ role: "assistant", content: body.content });
    const results: Block[] = [];
    for (const c of calls) {
      const name = String(c.name);
      used.push(name);
      const r = await runToolAsUser(name, (c.input as Record<string, unknown>) ?? {});
      results.push({ type: "tool_result", tool_use_id: c.id, content: JSON.stringify(r.ok ? r.data : { error: r.error }), ...(r.ok ? {} : { is_error: true }) });
    }
    messages.push({ role: "user", content: results });
  }
  return { ok: false, error: "AI butuh terlalu banyak langkah. Coba pertanyaan yang lebih spesifik." };
}
