import { Suspense } from "react";
import { headers } from "next/headers";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  History,
  Lightbulb,
  Radio,
  Sparkles,
} from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { configuredProviders } from "@/lib/ai/providers";
import { listAiCalls, listAiTokens, latestAiInsight } from "@/lib/ai/read";
import { runToolAsUser } from "@/lib/ai/run";
import type { HealthScore, Indicator } from "@/lib/ai/weekly";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AskBox, GenerateWeeklyButton, TokenManager } from "./_components/client";

export default function AiPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

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

function InsightSection({
  title,
  icon: Icon,
  iconColor,
  items,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="grid content-start gap-2 rounded-xl border border-border bg-card/60 p-3.5">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", iconColor)} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-1.5">
          {items.map((t) => (
            <li key={t} className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-foreground">
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "ai_analyst", "view", false)) return <NoAccess />;
  const canManage = can(ctx, "ai_analyst", "create", false);
  const askProviders = canManage ? await configuredProviders() : { providers: [], active: "" };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const [health, insight, tokens, calls] = await Promise.all([
    runToolAsUser("get_health_score"),
    latestAiInsight(),
    listAiTokens(),
    listAiCalls(25),
  ]);
  const hs = health.ok ? (health.data as HealthScore) : null;
  const score = hs?.score ?? null;

  return (
    <>
      <PageHeader
        title="AI Analyst"
        description="Analisis bisnis cerdas dari data bengkel. AI hanya membaca data dan tidak bisa mengubah apa pun."
        actions={canManage && <GenerateWeeklyButton />}
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
                <span
                  className={cn(
                    "text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl",
                    score !== null && score >= 75
                      ? "text-brand-green"
                      : score !== null && score >= 50
                        ? "text-brand-sand"
                        : "text-brand-red"
                  )}
                >
                  {score ?? "-"}
                </span>
                <span className="text-xs font-medium text-muted-foreground">/ 100</span>
              </div>
            </div>

            {!hs ? (
              <p role="alert" className="text-sm text-destructive">
                {health.ok ? "Memuat skor kesehatan..." : health.error}
              </p>
            ) : (
              <ul className="grid divide-y divide-border">
                {hs.indicators.map((i) => {
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
            )}
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
              <p className="text-xs text-muted-foreground">
                {insight
                  ? `Periode ${formatDate(insight.payload.period.from)} s/d ${formatDate(insight.payload.period.to)}`
                  : "Belum ada ringkasan"}
              </p>
            </div>

            {!insight ? (
              <EmptyState
                icon={Bot}
                text="Klik tombol Buat ringkasan sekarang di atas untuk meminta AI menganalisis kondisi bengkel minggu ini."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <InsightSection
                  title="Yang membaik"
                  icon={CheckCircle2}
                  iconColor="text-brand-green"
                  items={insight.payload.improving}
                  empty="Belum ada yang menonjol."
                />
                <InsightSection
                  title="Perlu perhatian"
                  icon={AlertTriangle}
                  iconColor="text-brand-sand"
                  items={insight.payload.attention}
                  empty="Tidak ada peringatan."
                />
                <InsightSection
                  title="Saran minggu depan"
                  icon={Lightbulb}
                  iconColor="text-brand-blue-fg"
                  items={insight.payload.suggestions}
                  empty="Tidak ada saran khusus."
                />
                <InsightSection
                  title="Pengingat"
                  icon={Clock}
                  iconColor="text-muted-foreground"
                  items={insight.payload.reminders}
                  empty="Tidak ada pengingat."
                />
              </div>
            )}
          </section>

          {/* Card Tanya AI */}
          <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Bot className="size-5 text-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Tanya AI bisnis</h2>
                <p className="text-xs text-muted-foreground">Tanyakan pertanyaan seputar tren servis, pelanggan, dan keuangan</p>
              </div>
            </div>
            <AskBox providers={askProviders.providers} active={askProviders.active} />
          </section>
        </div>
      </div>

      {/* Row / MCP & Riwayat */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {canManage && (
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
            <TokenManager tokens={tokens} mcpUrl={`${proto}://${host}/api/v1/mcp`} />
          </section>
        )}

        <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <History className="size-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Riwayat panggilan AI</h2>
              <p className="text-xs text-muted-foreground">25 panggilan tool terakhir ke sistem</p>
            </div>
          </div>
          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada panggilan AI tercatat.</p>
          ) : (
            <ul className="grid divide-y divide-border">
              {calls.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{c.tool}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateTime(c.created_at)} · {c.employee_name ?? "-"} · {c.source === "mcp" ? "MCP" : "Aplikasi"}
                      {Object.keys(c.params).length > 0 && ` · ${JSON.stringify(c.params)}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      c.ok ? "bg-muted text-foreground" : "bg-brand-red-soft text-brand-red"
                    )}
                  >
                    {c.ok ? `${c.duration_ms ?? 0} ms` : "Gagal"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
