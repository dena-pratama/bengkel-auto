import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  History,
  Lightbulb,
  Radio,
  Send,
  Sparkles,
} from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { HealthScore, Indicator } from "@/lib/ai/weekly";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama AI", position: "Business Analyst", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "Owner" }],
  permissions: [],
};

function createMockIndicator(
  partial: Partial<Indicator> & Pick<Indicator, "key" | "label" | "state" | "note">
): Indicator {
  return {
    value: 0,
    unit: "%",
    rule: "",
    score: 80,
    ...partial,
  };
}

const SAMPLE_HEALTH: HealthScore = {
  score: 78,
  computed_on: "2026-11-04T12:00:00Z",
  summary: { ok: 6, warn: 3, bad: 0, no_data: 0 },
  indicators: [
    createMockIndicator({ key: "gross_margin", label: "Margin laba kotor", note: "38.5% dari omzet jasa dan barang", state: "ok" }),
    createMockIndicator({ key: "net_margin", label: "Margin laba bersih", note: "14.2% setelah biaya operasional", state: "ok" }),
    createMockIndicator({ key: "cash_runway", label: "Ketahanan kas", note: "Saldo cukup untuk 2.4 bulan operasional", state: "warn" }),
    createMockIndicator({ key: "inventory_turnover", label: "Perputaran stok", note: "4.2x setahun, rata-rata industri", state: "ok" }),
    createMockIndicator({ key: "dead_stock", label: "Dead stock (>90 hari)", note: "6 SKU barang senilai Rp 3.200.000", state: "warn" }),
    createMockIndicator({ key: "ar_quality", label: "Kualitas piutang", note: "92% piutang lunas tepat waktu", state: "ok" }),
    createMockIndicator({ key: "revenue_growth", label: "Pertumbuhan omzet", note: "Naik 8.4% dibanding bulan lalu", state: "ok" }),
    createMockIndicator({ key: "customer_retention", label: "Retensi pelanggan", note: "64% pelanggan servis ulang dalam 6 bulan", state: "ok" }),
    createMockIndicator({ key: "operational_discipline", label: "Kedisiplinan operasional", note: "1 shift kas selisih kecil bulan ini", state: "warn" }),
  ],
};

const SAMPLE_CALLS = [
  { id: "c-1", tool: "get_financial_summary", created_at: "2026-11-04T10:15:00Z", employee_name: "Budi Santoso", source: "mcp", duration_ms: 120, ok: true, params: { period: "month" } },
  { id: "c-2", tool: "list_inventory_alerts", created_at: "2026-11-04T09:30:00Z", employee_name: "Budi Santoso", source: "mcp", duration_ms: 85, ok: true, params: {} },
  { id: "c-3", tool: "get_mechanic_performance", created_at: "2026-11-03T16:45:00Z", employee_name: "Budi Santoso", source: "app", duration_ms: 210, ok: true, params: {} },
];

const STATE_STYLE: Record<Indicator["state"], { badge: string; dot: string }> = {
  ok: { badge: "bg-brand-green-soft text-brand-green", dot: "bg-brand-green" },
  warn: { badge: "bg-brand-sand-soft text-brand-sand", dot: "bg-brand-sand" },
  bad: { badge: "bg-brand-red-soft text-brand-red", dot: "bg-brand-red" },
  na: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const STATE_LABEL: Record<Indicator["state"], string> = {
  ok: "Aman",
  warn: "Waspada",
  bad: "Bahaya",
  na: "Belum ada data",
};

export default function AiPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau AI Analyst...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <PageHeader
          title="AI Analyst"
          description="Analisis bisnis cerdas dari data bengkel. AI hanya membaca data dan tidak bisa mengubah apa pun."
          actions={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-rail px-4 text-xs font-semibold text-white shadow-sm hover:bg-brand-rail/90"
            >
              <Sparkles className="size-4" />
              Buat ringkasan sekarang
            </button>
          }
        />

        {/* Row / Skor & Insights */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          {/* Left: Card Skor Kesehatan */}
          <section className={cn(panel, "flex flex-col justify-between gap-4 p-4 sm:p-5")}>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="text-lg font-semibold">Skor kesehatan bisnis</h2>
                  <p className="text-xs text-muted-foreground">
                    Rata-rata 9 indikator keuangan, operasional, dan pelanggan
                  </p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tabular-nums tracking-tight text-brand-green sm:text-4xl">
                    78
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">/ 100</span>
                </div>
              </div>

              <ul className="grid divide-y divide-border">
                {SAMPLE_HEALTH.indicators.map((i) => {
                  const style = STATE_STYLE[i.state];
                  return (
                    <li key={i.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <span className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{i.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{i.note}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
                          style.badge
                        )}
                      >
                        {STATE_LABEL[i.state]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* Right Column: Ringkasan Mingguan & Tanya AI */}
          <div className="grid content-start gap-5">
            {/* Card Ringkasan Mingguan */}
            <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-brand-blue-fg" />
                  <h2 className="text-lg font-semibold">Ringkasan mingguan</h2>
                </div>
                <p className="text-xs text-muted-foreground">Periode 28 Okt s/d 4 Nov 2026</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid content-start gap-2 rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-brand-green" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Yang membaik
                    </h3>
                  </div>
                  <ul className="grid gap-1.5">
                    <li className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground">
                      Pendapatan jasa servis berkala naik 14% didorong promo ganti oli.
                    </li>
                    <li className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground">
                      Waktu tunggu rata-rata antrean work order turun dari 45 menit ke 28 menit.
                    </li>
                  </ul>
                </div>

                <div className="grid content-start gap-2 rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-brand-sand" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Perlu perhatian
                    </h3>
                  </div>
                  <ul className="grid gap-1.5">
                    <li className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground">
                      Stok oli Shell Helix HX6 menipis di bawah titik pemesanan ulang (tersisa 3 galon).
                    </li>
                    <li className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground">
                      Piutang PT Trans Mandiri senilai Rp 4.500.000 mendekati jatuh tempo 7 hari lagi.
                    </li>
                  </ul>
                </div>

                <div className="grid content-start gap-2 rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-brand-blue-fg" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Saran minggu depan
                    </h3>
                  </div>
                  <ul className="grid gap-1.5">
                    <li className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground">
                      Buat Purchase Order ke Distributor Oli Utama sebelum Kamis untuk mengamankan diskon volume.
                    </li>
                  </ul>
                </div>

                <div className="grid content-start gap-2 rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Pengingat
                    </h3>
                  </div>
                  <ul className="grid gap-1.5">
                    <li className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground">
                      Jadwal stok opname bulanan rak pelumas dan filter pada Sabtu 8 Nov 2026.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Card Tanya AI */}
            <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Bot className="size-5 text-foreground" />
                <div>
                  <h2 className="text-lg font-semibold">Tanya AI bisnis</h2>
                  <p className="text-xs text-muted-foreground">
                    Tanyakan pertanyaan seputar tren servis, pelanggan, dan keuangan
                  </p>
                </div>
              </div>
              <div className="grid gap-2.5">
                <textarea
                  rows={2}
                  placeholder="Contoh: Kenapa margin laba bulan ini turun dibanding bulan lalu?"
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-rail"
                />
                <button
                  type="button"
                  className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-brand-rail px-4 text-xs font-semibold text-white shadow-sm hover:bg-brand-rail/90"
                >
                  <Send className="size-3.5" />
                  Tanya AI
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Row / MCP & Riwayat */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Radio className="size-5 text-brand-blue-fg" />
              <div>
                <h2 className="text-lg font-semibold">Koneksi Claude (MCP)</h2>
                <p className="text-xs text-muted-foreground">
                  AI bertindak menggunakan hak akses Anda dan setiap panggilannya tercatat
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-3.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Alamat server MCP</p>
              <code className="mt-1 block rounded bg-background p-2 font-mono text-xs text-foreground">
                https://bengkel.automobi.id/api/v1/mcp
              </code>
              <p className="mt-2 text-[11px]">Pasang di Claude Desktop atau IDE via SSE connector.</p>
            </div>
          </section>

          <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <History className="size-5 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Riwayat panggilan AI</h2>
                <p className="text-xs text-muted-foreground">Panggilan tool terakhir ke sistem</p>
              </div>
            </div>
            <ul className="grid divide-y divide-border">
              {SAMPLE_CALLS.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{c.tool}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateTime(c.created_at)} · {c.employee_name} · MCP
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {c.duration_ms} ms
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
