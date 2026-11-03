import { Suspense } from "react";
import { headers } from "next/headers";
import { Bot } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { aiChatConfigured } from "@/lib/ai/chat";
import { listAiCalls, listAiTokens, latestAiInsight } from "@/lib/ai/read";
import { runToolAsUser } from "@/lib/ai/run";
import type { HealthScore, Indicator } from "@/lib/ai/weekly";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AskBox, GenerateWeeklyButton, TokenManager } from "./_components/client";

export default function AiPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

const STATE_STYLE: Record<Indicator["state"], string> = {
  ok: "bg-brand-rail text-white",
  warn: "bg-brand-sand-soft text-foreground",
  bad: "bg-brand-red-soft text-brand-red",
  na: "bg-muted text-muted-foreground",
};
const STATE_LABEL: Record<Indicator["state"], string> = { ok: "Aman", warn: "Waspada", bad: "Bahaya", na: "Belum ada data" };

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="grid content-start gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((t) => (
            <li key={t} className="rounded-2xl bg-muted/60 px-3 py-2 text-sm leading-relaxed">
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
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const [health, insight, tokens, calls] = await Promise.all([runToolAsUser("get_health_score"), latestAiInsight(), listAiTokens(), listAiCalls(25)]);
  const hs = health.ok ? (health.data as HealthScore) : null;

  return (
    <>
      <PageHeader title="AI Analyst" description="Analisis bisnis dari data bengkel. AI hanya membaca data dan tidak bisa mengubah apa pun." actions={canManage && <GenerateWeeklyButton />} />

      <section className={cn(panel, "grid gap-4")}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Skor kesehatan bisnis</h2>
            <p className="text-sm text-muted-foreground">Rata-rata 9 indikator yang punya data. Dihitung dari jurnal, stok, piutang, dan shift kas.</p>
          </div>
          <p className="text-4xl font-bold tabular-nums">{hs?.score ?? "-"}<span className="text-base font-medium text-muted-foreground"> / 100</span></p>
        </div>
        {!hs ? (
          <p role="alert" className="text-sm text-destructive">{health.ok ? "" : health.error}</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {hs.indicators.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{i.label}</p>
                  <p className="text-xs text-muted-foreground">{i.note}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STATE_STYLE[i.state])}>{STATE_LABEL[i.state]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cn(panel, "grid gap-4")}>
        <div>
          <h2 className="text-lg font-semibold">Ringkasan mingguan</h2>
          <p className="text-sm text-muted-foreground">
            {insight ? `Dibuat ${formatDateTime(insight.created_at)}, periode ${formatDate(insight.payload.period.from)} sampai ${formatDate(insight.payload.period.to)}.` : "Belum ada ringkasan."}
          </p>
        </div>
        {!insight ? (
          <EmptyState icon={Bot} text="Klik Buat ringkasan sekarang, atau jadwalkan panggilan POST /api/v1/ai/weekly tiap Senin pagi." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <List title="Yang membaik" items={insight.payload.improving} empty="Belum ada yang menonjol." />
            <List title="Perlu perhatian" items={insight.payload.attention} empty="Tidak ada peringatan." />
            <List title="Saran minggu depan" items={insight.payload.suggestions} empty="Tidak ada saran khusus." />
            <List title="Pengingat" items={insight.payload.reminders} empty="Tidak ada pengingat." />
          </div>
        )}
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Tanya AI</h2>
        <AskBox enabled={aiChatConfigured() && canManage} />
      </section>

      {canManage && (
        <section className={cn(panel, "grid gap-3")}>
          <div>
            <h2 className="text-lg font-semibold">Hubungkan ke Claude (MCP)</h2>
            <p className="text-sm text-muted-foreground">Token milik Anda sendiri; AI bertindak dengan izin Anda dan semua panggilannya tercatat.</p>
          </div>
          <TokenManager tokens={tokens} mcpUrl={`${proto}://${host}/api/v1/mcp`} />
        </section>
      )}

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Riwayat panggilan AI</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada panggilan.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.tool}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(c.created_at)} · {c.employee_name ?? "-"} · {c.source === "mcp" ? "MCP" : "Aplikasi"}
                    {Object.keys(c.params).length > 0 && ` · ${JSON.stringify(c.params)}`}
                  </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", c.ok ? "bg-muted" : "bg-brand-red-soft text-brand-red")}>{c.ok ? `${c.duration_ms ?? 0} ms` : "Gagal"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
