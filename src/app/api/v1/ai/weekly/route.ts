import { createAdminClient } from "@/lib/supabase/admin";
import { bearerToken, runToolWithToken } from "@/lib/ai/run";
import { buildWeeklySummary } from "@/lib/ai/weekly";
import { addDays, todayWib } from "@/lib/format";

// Dipanggil penjadwal (Coolify scheduled task / cron) tiap Senin pagi dengan token AI Analyst:
//   curl -X POST -H "Authorization: Bearer abk_..." https://<domain>/api/v1/ai/weekly
// Hasil disimpan sebagai ringkasan mingguan dan tampil di halaman AI Analyst.

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Token tidak ada atau formatnya salah." }, { status: 401 });
  const today = todayWib();
  const run = (tool: string, params?: Record<string, unknown>) => runToolWithToken(token, tool, params);
  const first = await run("get_health_score");
  if (!first.ok) return Response.json({ error: first.error }, { status: /Token tidak valid|tidak aktif/.test(first.error) ? 401 : 500 });

  const summary = await buildWeeklySummary(run, today, addDays(today, -6));
  const { data, error } = await createAdminClient().rpc("save_ai_insight_token", { p_token: token, p_payload: summary, p_score: summary.score });
  if (error) {
    console.error("[ai/weekly]", error.message);
    return Response.json({ error: "Gagal menyimpan ringkasan." }, { status: 500 });
  }
  return Response.json({ id: data, summary });
}
