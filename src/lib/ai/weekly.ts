import { formatRupiah } from "@/lib/format";
import type { ToolResult } from "@/lib/ai/run";

// Ringkasan mingguan berbasis aturan (PRD §13.4): 3 hal membaik, 3 perlu perhatian, saran minggu depan.
// Dihitung dari hasil tool, tanpa memanggil model bahasa, jadi angkanya selalu sama dengan laporan.

export type Indicator = { key: string; label: string; value: number | null; unit: string; rule: string; state: "ok" | "warn" | "bad" | "na"; score: number | null; note: string };
export type HealthScore = { score: number | null; computed_on: string; indicators: Indicator[]; summary: { ok: number; warn: number; bad: number; no_data: number } };

export type WeeklySummary = {
  generated_on: string;
  score: number | null;
  period: { from: string; to: string };
  improving: string[];
  attention: string[];
  suggestions: string[];
  reminders: string[];
};

type Runner = (tool: string, params?: Record<string, unknown>) => Promise<ToolResult>;
type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${v}%`);
const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

export async function buildWeeklySummary(run: Runner, today: string, weekAgo: string): Promise<WeeklySummary> {
  const [health, week, stock, cash, ar, tax, due] = await Promise.all([
    run("get_health_score"),
    run("get_business_summary", { from: weekAgo, to: today }),
    run("get_stock_alerts"),
    run("get_cash_position"),
    run("get_receivables_payables"),
    run("get_tax_summary"),
    run("get_service_due_customers", { months: 3, limit: 100 }),
  ]);
  const data = (r: ToolResult): Obj => (r.ok ? (r.data as Obj) : {});

  const improving: string[] = [];
  const attention: string[] = [];
  const suggestions: string[] = [];
  const reminders: string[] = [];

  const h = data(health) as Partial<HealthScore>;
  const w = data(week);
  const prev = w.previous_period ?? {};

  if (w.revenue !== undefined) {
    const d = delta(w.revenue, prev.revenue ?? 0);
    if (d !== null && d > 0) improving.push(`Omzet 7 hari terakhir ${formatRupiah(w.revenue)}, naik ${d}% dari 7 hari sebelumnya (${formatRupiah(prev.revenue)}).`);
    if (d !== null && d < 0) attention.push(`Omzet 7 hari terakhir ${formatRupiah(w.revenue)}, turun ${Math.abs(d)}% dari 7 hari sebelumnya (${formatRupiah(prev.revenue)}).`);
    if (w.net_profit < 0) attention.push(`Laba bersih 7 hari terakhir negatif: ${formatRupiah(w.net_profit)}.`);
    else if (w.net_profit > (prev.net_profit ?? 0) && w.net_profit > 0) improving.push(`Laba bersih 7 hari terakhir ${formatRupiah(w.net_profit)}, lebih tinggi dari minggu sebelumnya.`);
  }
  for (const i of h.indicators ?? []) {
    if (i.state === "ok" && i.value !== null) improving.push(`${i.label} aman: ${i.note}.`);
    if (i.state === "bad" || i.state === "warn") attention.push(`${i.label} ${i.state === "bad" ? "bahaya" : "waspada"}: ${i.note}. Batas: ${i.rule}.`);
  }

  const s = data(stock);
  const low = (s.low_stock?.length ?? 0) + (s.out_of_stock?.length ?? 0);
  if (low > 0) suggestions.push(`Belanja ulang ${low} barang yang menipis atau habis (mulai dari ${[...(s.out_of_stock ?? []), ...(s.low_stock ?? [])].slice(0, 3).map((x: Obj) => x.name).join(", ")}).`);
  if ((s.dead_stock?.length ?? 0) > 0) {
    const val = s.dead_stock.reduce((t: number, x: Obj) => t + Number(x.value), 0);
    suggestions.push(`Buat promo atau paket untuk ${s.dead_stock.length} barang dead stock (nilai ${formatRupiah(val)}), jangan beli lagi sebelum terjual.`);
  }
  const a = data(ar);
  const overdue = a.receivables?.overdue ?? [];
  if (overdue.length > 0) suggestions.push(`Tagih ${overdue.length} piutang yang lewat jatuh tempo, mulai dari ${overdue[0].customer} (${formatRupiah(overdue[0].outstanding)}, ${overdue[0].days_overdue} hari).`);
  const apDue = a.payables?.due_or_overdue ?? [];
  if (apDue.length > 0) reminders.push(`${apDue.length} hutang supplier jatuh tempo atau segera jatuh tempo, total ${formatRupiah(apDue.reduce((t: number, x: Obj) => t + Number(x.outstanding), 0))}.`);
  const dv = data(due).vehicles ?? [];
  if (dv.length > 0) suggestions.push(`${dv.length} kendaraan belum servis lebih dari 3 bulan. Hubungi pemiliknya untuk servis rutin.`);

  const c = data(cash);
  if (c.runway_days_all_costs !== undefined && c.runway_days_all_costs !== null && c.runway_days_all_costs < 30)
    suggestions.push(`Kas hanya cukup ${c.runway_days_all_costs} hari biaya. Tunda pembelian non-esensial dan percepat penagihan piutang.`);

  const t = data(tax);
  if (t.pph_final?.ceiling_used_pct !== null && t.pph_final?.ceiling_used_pct >= 80)
    reminders.push(`Omzet kumulatif tahun ini sudah ${t.pph_final.ceiling_used_pct}% dari batas PPh Final UMKM.`);
  if (t.ppn_this_month?.payable > 0) reminders.push(`PPN bulan ini kurang bayar ${formatRupiah(t.ppn_this_month.payable)} (sementara, belum akhir bulan).`);

  return {
    generated_on: today,
    score: h.score ?? null,
    period: { from: weekAgo, to: today },
    improving: improving.slice(0, 3),
    attention: attention.slice(0, 3),
    suggestions: suggestions.slice(0, 4),
    reminders,
  };
}

export { pct };
