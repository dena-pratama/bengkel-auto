import "server-only";
import { AI_SYSTEM_PROMPT, AI_TOOLS, type AiToolDef } from "@/lib/ai/tools";
import { runToolAsUser } from "@/lib/ai/run";
import { getProvider, type ProviderId } from "@/lib/ai/providers";

// "Tanya AI" di aplikasi: model bahasa memanggil tool read-only yang sama dengan server MCP.
// Penyedia (Anthropic, OpenAI, Gemini, OpenRouter) dipilih pengguna; kunci dari environment server.

const MAX_STEPS = 6;
const TIMEOUT_MS = 60_000;

type ToolCall = { id: string; name: string; input: Record<string, unknown> };
type Outcome = { ok: true; text: string; calls: ToolCall[] } | { ok: false; error: string };
type ToolOutcome = { id: string; name: string; ok: boolean; content: string };

/** Adaptor per format API: menyimpan riwayat sesuai format masing-masing penyedia. */
interface Adapter {
  send(): Promise<Outcome>;
  pushToolResults(results: ToolOutcome[]): void;
}

const systemText = () =>
  `${AI_SYSTEM_PROMPT} Hari ini ${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date())}.`;

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<{ ok: true; json: unknown } | { ok: false; status: number; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, status: res.status, text: (await res.text()).slice(0, 300) };
  return { ok: true, json: await res.json() };
}

// ---------------------------------------------------------------- Anthropic (Messages API)
class AnthropicAdapter implements Adapter {
  private messages: { role: "user" | "assistant"; content: unknown }[];
  constructor(
    private key: string,
    private model: string,
    question: string,
    private tools: AiToolDef[],
  ) {
    this.messages = [{ role: "user", content: question }];
  }
  async send(): Promise<Outcome> {
    const r = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.key, "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        max_tokens: 1500,
        system: systemText(),
        tools: this.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
        messages: this.messages,
      },
    );
    if (!r.ok) return { ok: false, error: httpError(r.status, r.text) };
    const body = r.json as { content: { type: string; [k: string]: unknown }[]; stop_reason: string };
    const calls = body.content
      .filter((b) => b.type === "tool_use")
      .map((b) => ({ id: String(b.id), name: String(b.name), input: (b.input as Record<string, unknown>) ?? {} }));
    const text = body.content.filter((b) => b.type === "text").map((b) => String(b.text)).join("\n").trim();
    if (body.stop_reason !== "tool_use" || calls.length === 0) return { ok: true, text, calls: [] };
    this.messages.push({ role: "assistant", content: body.content });
    return { ok: true, text, calls };
  }
  pushToolResults(results: ToolOutcome[]) {
    this.messages.push({
      role: "user",
      content: results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content, ...(r.ok ? {} : { is_error: true }) })),
    });
  }
}

// ---------------------------------------------------------------- OpenAI-compatible (GPT, OpenRouter)
class OpenAiAdapter implements Adapter {
  private messages: unknown[];
  constructor(
    private url: string,
    private headers: Record<string, string>,
    private model: string,
    question: string,
    private tools: AiToolDef[],
  ) {
    this.messages = [
      { role: "system", content: systemText() },
      { role: "user", content: question },
    ];
  }
  async send(): Promise<Outcome> {
    const r = await post(this.url, this.headers, {
      model: this.model,
      max_tokens: 1500,
      messages: this.messages,
      tools: this.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
    });
    if (!r.ok) return { ok: false, error: httpError(r.status, r.text) };
    const body = r.json as { choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] };
    const msg = body.choices?.[0]?.message;
    if (!msg) return { ok: true, text: "", calls: [] };
    const calls = (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) }));
    if (calls.length === 0) return { ok: true, text: (msg.content ?? "").trim(), calls: [] };
    this.messages.push(msg);
    return { ok: true, text: "", calls };
  }
  pushToolResults(results: ToolOutcome[]) {
    for (const r of results) this.messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
  }
}

// ---------------------------------------------------------------- Google Gemini (generateContent)
type GeminiPart = Record<string, unknown>;
class GeminiAdapter implements Adapter {
  private contents: { role: "user" | "model"; parts: GeminiPart[] }[];
  constructor(
    private key: string,
    private model: string,
    question: string,
    private tools: AiToolDef[],
  ) {
    this.contents = [{ role: "user", parts: [{ text: question }] }];
  }
  async send(): Promise<Outcome> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const r = await post(
      url,
      { "x-goog-api-key": this.key },
      {
        systemInstruction: { parts: [{ text: systemText() }] },
        contents: this.contents,
        tools: [{ functionDeclarations: this.tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.inputSchema) })) }],
        generationConfig: { maxOutputTokens: 1500 },
      },
    );
    if (!r.ok) return { ok: false, error: httpError(r.status, r.text) };
    const body = r.json as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
    const parts = body.candidates?.[0]?.content?.parts ?? [];
    const calls = parts
      .filter((p) => p.functionCall)
      .map((p, i) => {
        const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
        return { id: `${fc.name}-${i}`, name: fc.name, input: fc.args ?? {} };
      });
    const text = parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("").trim();
    if (calls.length === 0) return { ok: true, text, calls: [] };
    this.contents.push({ role: "model", parts });
    return { ok: true, text, calls };
  }
  pushToolResults(results: ToolOutcome[]) {
    this.contents.push({
      role: "user",
      parts: results.map((r) => ({ functionResponse: { name: r.name, response: { result: r.content } } })),
    });
  }
}

// ---------------------------------------------------------------- Helper

function httpError(status: number, text: string): string {
  console.error("[ai/chat]", status, text);
  if (status === 401 || status === 403) return "Kunci API penyedia ditolak. Periksa kunci di environment server.";
  if (status === 429) return "Batas pemakaian penyedia AI tercapai. Coba lagi nanti.";
  return "Layanan AI sedang tidak bisa dihubungi. Coba lagi.";
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Gemini hanya menerima subset skema OpenAPI: buang kata kunci JSON Schema yang tidak didukung. */
function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "$schema" || k === "additionalProperties" || k === "pattern") continue;
    out[k] = geminiSchema(v);
  }
  return out;
}

function makeAdapter(providerId: ProviderId, key: string, model: string, question: string): Adapter {
  const tools = AI_TOOLS;
  switch (providerId) {
    case "anthropic":
      return new AnthropicAdapter(key, model, question, tools);
    case "openai":
      return new OpenAiAdapter("https://api.openai.com/v1/chat/completions", { authorization: `Bearer ${key}` }, model, question, tools);
    case "openrouter":
      return new OpenAiAdapter(
        "https://openrouter.ai/api/v1/chat/completions",
        { authorization: `Bearer ${key}`, "x-title": "AutoMobi" },
        model,
        question,
        tools,
      );
    case "gemini":
      return new GeminiAdapter(key, model, question, tools);
  }
}

export async function askAnalyst(
  question: string,
  providerId: string,
): Promise<{ ok: true; answer: string; tools: string[]; provider: string; model: string } | { ok: false; error: string }> {
  const p = getProvider(providerId);
  if (!p) return { ok: false, error: "Penyedia AI ini belum aktif. Isi kuncinya di environment server." };
  const adapter = makeAdapter(p.id, p.key, p.model, question);
  const used: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const out = await adapter.send();
    if (!out.ok) return out;
    if (out.calls.length === 0) {
      return { ok: true, answer: out.text || "AI tidak memberi jawaban.", tools: used, provider: p.label, model: p.model };
    }
    const results: ToolOutcome[] = [];
    for (const c of out.calls) {
      used.push(c.name);
      const r = await runToolAsUser(c.name, c.input);
      results.push({ id: c.id, name: c.name, ok: r.ok, content: JSON.stringify(r.ok ? r.data : { error: r.error }) });
    }
    adapter.pushToolResults(results);
  }
  return { ok: false, error: "AI butuh terlalu banyak langkah. Coba pertanyaan yang lebih spesifik." };
}
