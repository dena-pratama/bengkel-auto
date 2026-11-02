import {
  ArrowUpRight,
  BellRing,
  Download,
  Gauge,
  MessageCircle,
  MoreHorizontal,
  Wrench,
} from "lucide-react";
import {
  activeWorkOrder,
  alerts,
  bayCapacity,
  healthScore,
  reminders,
  revenueTrend,
  serviceFlow,
  workshopStats,
} from "@/lib/demo/dashboard";
import { cn } from "@/lib/utils";

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const juta = (n: number) =>
  `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;

export const card = "rounded-2xl border border-border bg-card p-5";

function CardHead({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function LinkText({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-foreground underline underline-offset-4">
      {children}
    </span>
  );
}

function Chip({
  children,
  tone = "red",
  active = false,
}: {
  children: React.ReactNode;
  tone?: "red" | "blue" | "sand";
  active?: boolean;
}) {
  const tones = {
    red: active
      ? "bg-brand-red text-white"
      : "border border-brand-red/40 text-brand-red",
    blue: "bg-brand-blue-soft text-brand-blue-ink",
    sand: "bg-brand-sand-soft text-[#6b5d33]",
  };
  return (
    <span
      className={cn("rounded-full px-3 py-1 text-xs font-medium", tones[tone])}
    >
      {children}
    </span>
  );
}

// Titik tahap servis di viewBox 1000x260. Kurva digambar MELEWATI titik-titik ini (Catmull-Rom → Bezier).
const FLOW_POINTS = [
  { x: 90, y: 200 },
  { x: 290, y: 150 },
  { x: 500, y: 170 },
  { x: 710, y: 100 },
  { x: 910, y: 62 },
];

function smoothPath(points: { x: number; y: number }[]) {
  const p = [{ x: 0, y: 235 }, ...points, { x: 1000, y: 40 }];
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/* ---------------------------------------------------------------- Alur servis */
export function ServiceFlowCard() {
  const points = FLOW_POINTS;
  const total = serviceFlow.reduce((s, f) => s + f.count, 0);

  return (
    <section className={cn(card, "relative overflow-hidden p-0 lg:col-span-3")}>
      {/* Pola grid pasir sebagai "peta" bengkel */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(var(--brand-sand-soft) 1px, transparent 1px), linear-gradient(90deg, var(--brand-sand-soft) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="relative grid gap-4 p-5 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Chip active>Papan servis</Chip>
            <Chip>Per mekanik</Chip>
            <Chip>Per bay</Chip>
          </div>

          <div className="grid gap-4 sm:grid-cols-[230px_1fr]">
            <div className="grid content-start gap-4 rounded-xl bg-card/90 p-4 backdrop-blur-sm">
              <div>
                <p className="text-xs text-muted-foreground">
                  Rata-rata durasi servis
                </p>
                <p className="text-2xl font-semibold text-brand-red">
                  {Math.floor(workshopStats.avgDurationMin / 60)}
                  <span className="text-sm font-normal">j </span>
                  {workshopStats.avgDurationMin % 60}
                  <span className="text-sm font-normal">m</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Utilisasi mekanik
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-semibold text-brand-red">
                    {workshopStats.mechanicUtilization}%
                  </p>
                  <div className="h-1.5 flex-1 rounded-full bg-brand-sand-soft">
                    <div
                      className="h-full rounded-full bg-brand-red"
                      style={{ width: `${workshopStats.mechanicUtilization}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="whitespace-nowrap rounded-full bg-brand-red px-3 py-1.5 text-xs font-medium text-white">
                  Atur antrian
                </span>
                <span className="whitespace-nowrap rounded-full border border-brand-red/40 px-3 py-1.5 text-xs font-medium text-brand-red">
                  Lihat semua
                </span>
              </div>
            </div>

            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:thin]">
              <div className="relative min-h-[220px] min-w-[520px]">
                <svg
                  viewBox="0 0 1000 260"
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d={smoothPath(points)}
                    fill="none"
                    stroke="var(--brand-red)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {serviceFlow.map((step, i) => (
                  <div
                    key={step.key}
                    className="absolute"
                    style={{
                      left: `${points[i].x / 10}%`,
                      top: `${(points[i].y / 260) * 100}%`,
                    }}
                  >
                    {/* Titik tepat di koordinat kurva; label selang-seling atas/bawah agar tidak menimpa garis */}
                    <span className="absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-brand-red text-xs font-semibold text-white shadow-md ring-4 ring-brand-red/20">
                      {step.count}
                    </span>
                    <span
                      className={cn(
                        "absolute whitespace-nowrap rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium shadow-sm",
                        i === points.length - 1
                          ? "-translate-x-[85%]"
                          : "-translate-x-1/2",
                        i % 2 === 0 ? "top-5" : "bottom-5",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
                <p className="absolute right-0 bottom-0 rounded-md bg-card/90 px-2 py-1 text-xs text-muted-foreground">
                  {total} kendaraan di bengkel
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-card/95 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Peringatan</p>
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-red-soft text-brand-red">
              <BellRing className="size-3.5" />
            </span>
          </div>
          <ul className="grid gap-3">
            {alerts.map((a) => (
              <li
                key={a.title}
                className="border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{a.title}</p>
                  <span className="text-[11px] text-muted-foreground">
                    {a.time}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {a.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Detail WO */
export function WorkOrderCard() {
  const wo = activeWorkOrder;
  const eta = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(wo.eta));

  return (
    <section className={cn(card, "lg:col-span-2")}>
      <CardHead
        title="Work order berjalan"
        action={<LinkText>Lihat semua</LinkText>}
      />
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-blue-soft text-sm font-semibold text-brand-blue-ink">
          {wo.customer
            .split(" ")
            .map((w) => w[0])
            .join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{wo.customer}</p>
          <p className="truncate text-xs text-muted-foreground">
            {wo.number} · {wo.vehicle}
          </p>
        </div>
        <span className="rounded-md border-2 border-foreground px-2 py-0.5 font-mono text-xs font-semibold tracking-wider">
          {wo.plate}
        </span>
        <MoreHorizontal className="hidden size-4 text-muted-foreground sm:block" />
      </div>

      <div className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-3">
        <div className="border-b border-border p-4 sm:border-r sm:border-b-0">
          <p className="text-sm font-medium">Estimasi biaya</p>
          {wo.dpPaid && (
            <p className="text-xs text-brand-red">DP sudah dibayar</p>
          )}
          <p className="mt-6 text-2xl font-semibold text-brand-red">
            {rupiah(wo.estimate)}
          </p>
        </div>
        <div className="border-b border-border p-4 sm:border-r sm:border-b-0">
          <p className="text-sm font-medium">Progres pekerjaan</p>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Antri</span>
            <span>Siap diambil</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-brand-sand-soft">
            <div
              className="h-full rounded-full bg-foreground"
              style={{ width: `${wo.progress}%` }}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Estimasi selesai</p>
          <p className="text-2xl font-semibold text-brand-red">
            {eta.replace(",", "")}
          </p>
        </div>
        <div className="grid content-start gap-4 p-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Status</p>
            <Chip active>{wo.status}</Chip>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Jenis servis</p>
            <Chip tone="sand">{wo.serviceType}</Chip>
          </div>
          <p className="text-xs text-muted-foreground">
            Mekanik:{" "}
            <span className="font-medium text-foreground">{wo.mechanic}</span> ·{" "}
            {wo.km.toLocaleString("id-ID")} km
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Kapasitas bay */
export function BayCapacityCard() {
  const pct = Math.round((bayCapacity.used / bayCapacity.total) * 100);
  return (
    <section className={card}>
      <CardHead
        title="Kapasitas bengkel"
        action={<LinkText>Detail</LinkText>}
      />
      <div className="relative flex h-24 items-center overflow-hidden rounded-xl border border-border bg-brand-sand-soft/50">
        <div
          className="flex h-full items-center justify-center text-3xl font-semibold text-white"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--brand-red)",
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(255,255,255,.18) 0 8px, transparent 8px 16px)",
          }}
        >
          {pct}%
        </div>
        <Wrench className="mx-auto size-6 text-[#a3936a]" aria-hidden />
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Bay terisi</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <span className="size-2 rounded-full bg-brand-red" />
            {bayCapacity.used} dari {bayCapacity.total}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Mekanik bertugas</dt>
          <dd className="font-medium">{bayCapacity.mechanicsOnDuty} orang</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Lift kosong</dt>
          <dd className="font-medium">{bayCapacity.liftsFree}</dd>
        </div>
      </dl>
    </section>
  );
}

/* ---------------------------------------------------------------- Tren omzet */
export function RevenueTrendCard() {
  const max = Math.max(...revenueTrend.map((d) => d.value));
  const today = revenueTrend.length - 1;
  return (
    <section className={card}>
      <CardHead
        title="Tren omzet"
        action={
          <span
            className="flex size-7 items-center justify-center rounded-full bg-brand-red text-white"
            title="Ekspor (segera)"
          >
            <Download className="size-3.5" />
          </span>
        }
      />
      <Chip active>{juta(revenueTrend[today].value)} hari ini</Chip>
      <div className="mt-3 flex h-36 items-end justify-between gap-1 border-b border-dashed border-border">
        {revenueTrend.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full flex-1 flex-col items-center justify-end"
            title={`${d.day}: ${rupiah(d.value)}`}
          >
            <span
              className={cn(
                "mb-1 rounded-full",
                i === today
                  ? "size-3 bg-brand-red ring-4 ring-brand-red/20"
                  : "size-2 bg-zinc-500",
              )}
            />
            <span
              className={cn(
                "w-0.5 rounded-full",
                i === today ? "bg-brand-red" : "bg-zinc-400",
              )}
              style={{ height: `${(d.value / max) * 80}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {revenueTrend.map((d) => (
          <span key={d.day} className="flex-1 text-center">
            {d.day}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Skor kesehatan */
export function HealthScoreCard() {
  const { score, trend } = healthScore;
  const min = Math.min(...trend) - 5;
  const max = 100;
  const path = trend
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(i / (trend.length - 1)) * 200} ${60 - ((v - min) / (max - min)) * 60}`,
    )
    .join(" ");

  return (
    <section className="flex flex-col rounded-2xl bg-brand-red p-5 text-white shadow-lg shadow-brand-red/25">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Skor kesehatan bisnis</h2>
        <span className="flex size-7 items-center justify-center rounded-full bg-white/20">
          <Gauge className="size-3.5" />
        </span>
      </div>
      <div className="mt-4 flex items-end gap-4">
        <p className="text-6xl font-semibold leading-none">
          {score}
          <span className="text-xl font-normal text-white/80">/100</span>
        </p>
        <svg viewBox="0 0 200 64" className="h-16 flex-1" aria-hidden>
          <path
            d={path}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle
            cx="200"
            cy={60 - ((trend.at(-1)! - min) / (max - min)) * 60}
            r="4"
            fill="white"
          />
        </svg>
      </div>
      <p className="mt-auto pt-4 text-xs text-white/85">
        Ringkasan AI Business Analyst dikirim setiap Senin pagi.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- Pengingat */
export function RemindersCard() {
  return (
    <section className={card}>
      <CardHead
        title="Pengingat"
        action={
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-red text-white">
            <ArrowUpRight className="size-3.5" />
          </span>
        }
      />
      <ul className="grid gap-3">
        {reminders.map((r) => (
          <li key={r.text} className="flex gap-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-blue-soft text-brand-blue-ink">
              <MessageCircle className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-muted px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{r.who}</p>
              <p className="text-xs leading-relaxed">{r.text}</p>
              {r.action && (
                <span className="mt-1.5 inline-block text-xs font-medium text-brand-red">
                  {r.action} →
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
