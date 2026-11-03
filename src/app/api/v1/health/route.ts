import { connection } from "next/server";
import { serverEnv } from "@/lib/env";
import { version } from "../../../../../package.json";

/** GET /api/v1/health: cek aplikasi dan koneksi ke Supabase (Auth via Kong). */
export async function GET() {
  await connection();
  const env = serverEnv();
  const baseUrl = env.SUPABASE_INTERNAL_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const started = Date.now();

  let supabase: { ok: boolean; status?: number; error?: string };
  try {
    const res = await fetch(`${baseUrl}/auth/v1/health`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(5000),
    });
    supabase = { ok: res.ok, status: res.status };
  } catch (e) {
    supabase = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return Response.json(
    {
      status: supabase.ok ? "ok" : "degraded",
      version,
      time: new Date().toISOString(),
      latency_ms: Date.now() - started,
      supabase,
    },
    { status: supabase.ok ? 200 : 503 },
  );
}
