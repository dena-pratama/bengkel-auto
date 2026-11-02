import {
  AlarmClock,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Edit3,
  Mail,
  MoreHorizontal,
  Package,
  PackageX,
  Pencil,
  Plus,
  QrCode,
  ReceiptText,
  Share2,
  Trash2,
  Truck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { agenda, cashShift, lowStock, mechanicJob, notifications, targets, todayWorkOrders } from "@/lib/demo/dashboard";
import { cn } from "@/lib/utils";

export const card = "min-w-0 rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgb(23_36_51/0.04),0_8px_24px_-12px_rgb(23_36_51/0.08)]";

function CardHead({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

function GhostAction({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

function IconButton({ icon: Icon, label, tone = "muted" }: { icon: LucideIcon; label: string; tone?: "muted" | "blue" }) {
  return (
    <span
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg",
        tone === "blue" ? "bg-brand-blue-ink text-white" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ================================================================ Hero */
export function Hero({ firstName }: { firstName: string }) {
  return (
    <section className="flex flex-col justify-center gap-3 py-2 md:col-span-2 xl:col-span-5">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        Halo, {firstName}!
        <br />
        Apa rencana bengkel hari ini?
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        Pantau servis, kasir, stok, dan keuangan bengkel dari satu tempat. Semua tercatat otomatis.
      </p>
    </section>
  );
}

/* ================================================================ Tile aksi cepat */
const QUICK_TILES: { title: string; desc: string; icon: LucideIcon; badge: LucideIcon }[] = [
  { title: "Terima kendaraan", desc: "Estimasi & work order", icon: Car, badge: ClipboardList },
  { title: "Kasir cepat", desc: "Jual part & terima bayar", icon: ReceiptText, badge: Plus },
  { title: "Cek stok", desc: "Scan QR barang & rak", icon: QrCode, badge: Package },
];

export function QuickTiles() {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:col-span-2 xl:col-span-7">
      <div
        title="Buat Work Order baru (tersedia setelah modul Servis)"
        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-blue/50 bg-brand-blue-soft/40 text-brand-blue-ink sm:aspect-auto"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-blue-ink text-white shadow-md shadow-brand-blue-ink/30">
          <Plus className="size-5" />
        </span>
        <span className="px-2 text-center text-xs font-medium">Work order baru</span>
      </div>
      {QUICK_TILES.map(({ title, desc, icon: Icon, badge: Badge }) => (
        <div key={title} className={cn(card, "flex flex-col gap-3 p-4")} title={`${title} (segera)`}>
          <div className="relative mx-auto flex aspect-[4/3] w-full max-w-36 items-center justify-center rounded-2xl bg-brand-blue-soft">
            <div className="absolute top-3 left-3 h-1.5 w-8 rounded-full bg-brand-blue/50" />
            <div className="absolute top-6 left-3 h-1.5 w-5 rounded-full bg-brand-blue/30" />
            <Icon className="size-12 text-brand-blue-ink" strokeWidth={1.5} />
            <span className="absolute right-3 bottom-3 flex size-7 items-center justify-center rounded-lg bg-brand-red text-white shadow-md shadow-brand-red/30">
              <Badge className="size-3.5" />
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ================================================================ Notifikasi */
export function NotificationsCard() {
  const [alert, message] = notifications;
  return (
    <section className={cn(card, "xl:col-span-4")}>
      <CardHead title="Notifikasi">
        <GhostAction icon={X}>Bersihkan</GhostAction>
      </CardHead>
      <div className="grid grid-cols-1 gap-3">
        <div className="flex min-w-0 gap-2">
          <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 shadow-md shadow-brand-blue-ink/5">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {alert.title}
                <span className="size-2 rounded-full bg-brand-red" />
              </p>
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">{alert.meta}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1">
                <AlarmClock className="size-3.5 text-brand-red" /> {alert.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5 text-muted-foreground" /> {alert.time} WIB
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1 rounded-2xl bg-brand-blue-soft px-1">
            <IconButton icon={Trash2} label="Hapus" />
            <IconButton icon={Pencil} label="Tindak lanjut" />
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border p-4 sm:ml-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{message.title}</p>
            <MoreHorizontal className="size-4 text-muted-foreground" />
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="size-3.5" /> {message.meta}
          </p>
          <p className="mt-2 truncate rounded-lg bg-brand-blue-soft px-3 py-1.5 text-xs text-brand-blue-deep">{message.preview}</p>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ Pekerjaan mekanik */
export function MechanicJobCard() {
  const job = mechanicJob;
  return (
    <section className={cn(card, "xl:col-span-4")}>
      <CardHead title="Pekerjaan mekanik">
        <GhostAction icon={Edit3}>Ubah</GhostAction>
      </CardHead>
      <div className="rounded-2xl border border-border p-4 shadow-md shadow-brand-blue-ink/5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <p>
            <span className="font-medium text-brand-blue-ink">{job.category}</span>
            <span className="mx-1.5 text-muted-foreground">|</span>
            <span className="font-mono font-semibold">{job.plate}</span>
          </p>
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="text-[15px] leading-snug font-semibold">{job.title}</p>
          <span className="shrink-0 rounded-lg bg-brand-red-soft px-2.5 py-1 text-xs font-medium text-brand-red">{job.priority}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="rounded-lg bg-brand-blue px-2.5 py-1 text-xs font-medium text-brand-blue-deep">{job.tag}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {job.mechanic}
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-blue-soft text-[10px] font-semibold text-brand-blue-ink">
              {job.mechanic[0]}
            </span>
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-blue/50 bg-brand-blue-soft/40 py-4 text-sm font-medium text-brand-blue-ink">
        <span className="flex size-6 items-center justify-center rounded-md bg-brand-blue-ink text-white">
          <Plus className="size-4" />
        </span>
        Tugaskan pekerjaan baru
      </div>
    </section>
  );
}

/* ================================================================ Agenda (kalender minggu ini) */
export function AgendaCard() {
  const tz = "Asia/Jakarta";
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(today);
  const dayName = new Intl.DateTimeFormat("id-ID", { weekday: "short" });
  const icons = { car: Car, truck: Truck };

  return (
    <section className={cn(card, "md:col-span-2 xl:col-span-4")}>
      <CardHead title={<span className="capitalize">{monthLabel}</span>}>
        <div className="flex gap-1">
          <span className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground">
            <ChevronLeft className="size-4" />
          </span>
          <span className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground">
            <ChevronRight className="size-4" />
          </span>
        </div>
      </CardHead>
      <div className="grid grid-cols-7 text-center">
        {days.map((d) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={d.toISOString()} className="grid gap-1.5">
              <span className="text-[11px] text-muted-foreground">{dayName.format(d)}</span>
              <span
                className={cn(
                  "mx-auto flex size-8 items-center justify-center rounded-full text-sm font-medium",
                  isToday && "bg-brand-blue-ink text-white shadow-md shadow-brand-blue-ink/30",
                )}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>
      <ul className="mt-4 grid gap-1">
        {agenda.map((a) => {
          const Icon = icons[a.icon];
          return (
            <li key={a.title}>
              <div className="flex items-center gap-3 py-2 text-sm font-medium">
                {a.slot}
                <span className="h-px flex-1 border-t border-dashed border-border" />
              </div>
              <div className="flex items-center gap-3 rounded-2xl p-2 hover:bg-muted">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue-soft text-brand-blue-ink">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {a.meta}
                    {a.urgent && <span className="size-1.5 rounded-full bg-brand-red" />}
                  </p>
                </div>
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ================================================================ Work order hari ini */
export function TodayWorkOrdersCard() {
  return (
    <section className={cn(card, "md:col-span-2 xl:col-span-5")}>
      <CardHead
        title={
          <span className="flex items-center gap-3">
            Work order hari ini
            <span className="flex -space-x-2">
              {["R", "A", "J"].map((m) => (
                <span key={m} className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-brand-blue-soft text-[10px] font-semibold text-brand-blue-ink">
                  {m}
                </span>
              ))}
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-brand-blue-ink text-white">
                <Plus className="size-3.5" />
              </span>
            </span>
          </span>
        }
      >
        <div className="hidden items-center gap-3 sm:flex">
          <GhostAction icon={Edit3}>Ubah</GhostAction>
          <GhostAction icon={Share2}>Bagikan</GhostAction>
        </div>
      </CardHead>
      <ul className="grid gap-1">
        {todayWorkOrders.map((wo, i) => (
          <li
            key={wo.plate}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-2xl p-3 sm:grid-cols-[minmax(0,1.5fr)_auto_minmax(110px,1fr)]",
              i === 0 && "bg-card shadow-lg shadow-brand-blue-ink/10 ring-1 ring-border",
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{wo.title}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                <span className="font-mono font-medium text-foreground">{wo.plate}</span>
                <span>{wo.start}</span>
                <span className="flex items-center gap-0.5" title="Part dipakai">
                  <Package className="size-3" /> {wo.parts}
                </span>
                <span className="flex items-center gap-0.5" title="Mekanik">
                  <Wrench className="size-3" /> {wo.mechanic}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Durasi</p>
              <p className="text-xs font-semibold">{wo.duration}</p>
            </div>
            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
              <span className="w-8 text-xs font-medium">{wo.progress}%</span>
              <span className="h-1 flex-1 rounded-full bg-brand-blue-soft">
                <span
                  className={cn("block h-full rounded-full", wo.progress >= 80 ? "bg-brand-blue-ink" : "bg-brand-blue")}
                  style={{ width: `${wo.progress}%` }}
                />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ================================================================ Stok menipis (kartu sorotan merah) */
export function LowStockCard() {
  return (
    <section className="relative flex min-w-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl bg-brand-red p-6 text-center text-white shadow-xl shadow-brand-red/25 xl:col-span-3">
      <div aria-hidden className="absolute -top-10 -right-10 size-32 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-12 -left-8 size-28 rounded-full bg-white/10" />
      <span className="relative flex size-16 items-center justify-center rounded-2xl bg-white/15">
        <PackageX className="size-8" strokeWidth={1.5} />
      </span>
      <div className="relative">
        <p className="text-2xl font-semibold">{lowStock.count} barang menipis</p>
        <p className="mt-1 text-sm text-white/85">
          {lowStock.topItem} tersisa {lowStock.left} pcs. Buat PO sebelum stok habis.
        </p>
      </div>
      <span className="relative mt-1 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-red shadow-md">Buat purchase order</span>
    </section>
  );
}

/* ================================================================ Target (cincin progres) */
function Ring({ pct, tone }: { pct: number; tone: "blue" | "red" }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--brand-blue-soft)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={tone === "blue" ? "var(--brand-blue-ink)" : "var(--brand-red)"}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
      />
    </svg>
  );
}

export function TargetsCards() {
  return (
    <>
      {targets.map((t) => (
        <section key={t.label} className={cn(card, "flex flex-col gap-3 p-4")}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Ring pct={t.pct} tone={t.tone} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">{t.pct}%</span>
            </div>
            <div className="min-w-0">
              <p className={cn("text-[10px] font-semibold tracking-wide uppercase", t.tone === "blue" ? "text-brand-blue-ink" : "text-brand-red")}>
                {t.group}
              </p>
              <p className="text-sm font-semibold">{t.label}</p>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-[11px] leading-snug text-muted-foreground">{t.note}</p>
            {t.action && <span className="rounded-lg bg-brand-blue-ink px-3 py-1 text-xs font-medium text-white">{t.action}</span>}
          </div>
        </section>
      ))}
    </>
  );
}

/* ================================================================ Tutup kas shift */
export function CashShiftCard() {
  return (
    <section className={cn(card, "col-span-2")}>
      <CardHead title={cashShift.title}>
        <GhostAction icon={Edit3}>Ubah</GhostAction>
      </CardHead>
      <p className="-mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-brand-blue" /> {cashShift.time}
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-stretch">
        <p className="text-sm text-muted-foreground">{cashShift.detail}</p>
        <div className="flex shrink-0 gap-2 xl:justify-end">
          <span className="rounded-xl bg-brand-blue-soft px-4 py-2 text-sm font-medium text-brand-blue-deep">Lihat</span>
          <span className="rounded-xl bg-brand-blue-ink px-4 py-2 text-sm font-medium text-white">Tutup shift</span>
        </div>
      </div>
    </section>
  );
}
