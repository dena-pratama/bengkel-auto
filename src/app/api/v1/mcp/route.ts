import { AI_TOOLS, AI_TOOL_NAMES } from "@/lib/ai/tools";
import { bearerToken, runToolWithToken } from "@/lib/ai/run";

// Server MCP (JSON-RPC lewat HTTP, tanpa sesi) untuk AI Analyst, PRD §13.1.
// Auth: token pribadi (Bearer abk_...) yang dibuat di halaman AI Analyst. Semua tool read-only.

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const reply = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg: Rpc, token: string): Promise<unknown | null> {
  const { id, method, params } = msg;
  if (method === undefined) return fail(id, -32600, "Permintaan tidak valid");
  if (id === undefined) return null; // notifikasi (mis. notifications/initialized): tanpa balasan

  switch (method) {
    case "initialize": {
      const asked = String(params?.protocolVersion ?? "");
      return reply(id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "autobengkel-analyst", version: "1.0.0" },
        instructions: "Tool read-only untuk menganalisis data bengkel. Sebutkan periode dan sumber angka di setiap jawaban.",
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: AI_TOOLS });
    case "tools/call": {
      const name = String(params?.name ?? "");
      if (!AI_TOOL_NAMES.has(name)) return fail(id, -32602, `Tool "${name}" tidak dikenal`);
      const args = params?.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
      const res = await runToolWithToken(token, name, args);
      if (!res.ok && /Token tidak valid|tidak aktif/.test(res.error)) throw new Error(res.error);
      if (!res.ok) return reply(id, { isError: true, content: [{ type: "text", text: res.error }] });
      return reply(id, { content: [{ type: "text", text: JSON.stringify(res.data) }] });
    }
    default:
      return fail(id, -32601, `Metode "${method}" tidak didukung`);
  }
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Token tidak ada atau formatnya salah. Buat token di halaman AI Analyst." }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(fail(null, -32700, "JSON tidak valid"), { status: 400 });
  }

  try {
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map((m) => handle(m as Rpc, token)))).filter((x) => x !== null);
      return out.length ? Response.json(out) : new Response(null, { status: 202 });
    }
    const out = await handle(body as Rpc, token);
    return out === null ? new Response(null, { status: 202 }) : Response.json(out);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Kesalahan server";
    // Token ditolak database: balas 401 agar klien tahu harus mengganti token
    if (/Token tidak valid|tidak aktif/.test(message)) return Response.json({ error: message }, { status: 401 });
    console.error("[mcp]", message);
    return Response.json(fail((body as Rpc)?.id, -32603, "Kesalahan server"), { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: "Gunakan POST (MCP JSON-RPC)." }, { status: 405, headers: { Allow: "POST" } });
}
