import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Info,
  Plus,
  QrCode,
  ReceiptText,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { DashboardData, DashWorkOrder } from "@/lib/dashboard";
import { formatDuration, formatRupiah } from "@/lib/format";
import { timeAgo, type Severity } from "@/lib/validation/notifications";
import { WO_STATUS_LABEL, type WorkOrderStatus } from "@/lib/validation/service";
import { panel } from "@/components/page-kit";
import { cn } from "@/lib/utils";

type Tone = "muted" | "blue" | "sand" | "green" | "red";
const TONE: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground",
  blue: "bg-brand-blue-soft text-brand-blue-fg",
  sand: "bg-brand-sand-soft text-brand-sand",
  green: "bg-brand-green-soft text-brand-green",
  red: "bg-brand-red-soft text-brand-red",
};
const STATUS_TONE: Record<WorkOrderStatus, Tone> = {
  queued: "muted",
  in_progress: "blue",
  waiting_parts: "sand",
  waiting_approval: "sand",
  quality_check: "blue",
  ready: "green",
  delivered: "muted",
  void: "muted",
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-2xs font-medium", TONE[tone])}>{children}</span>;
}

function CardHead({ title, hint, children }: { title: React.ReactNode; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-blue-fg hover:underline">
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

/** "Rp 128 jt", "Rp 24,8 jt", "Rp 1,2 M" untuk kartu ringkas */
function rupiahShort(n: number): string {
  const f = (v: number, unit: string) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: v < 100 ? 1 : 0 }).format(v)} ${unit}`;
  if (n >= 1e9) return f(n / 1e9, "M");
  if (n >= 1e6) return f(n / 1e6, "jt");
  if (n >= 1e4) return f(n / 1e3, "rb");
  return formatRupiah(n);
}

/* ================================================================ Sapaan */
export function Hero({ firstName }: { firstName: string }) {
  return (
    <section className="grid gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[28px]">Halo, {firstName}! Apa rencana bengkel hari ini?</h1>
      <p className="text-sm text-muted-foreground">Pantau servis, kasir, stok, dan keuangan bengkel dari satu tempat. Semua tercatat otomatis.</p>
    </section>
  );
}

/* ================================================================ Aksi cepat */
const QUICK: { href: string; title: string; desc: string; icon: LucideIcon; primary?: boolean }[] = [
  { href: "/servis/estimasi", title: "Work order baru", desc: "Mulai dari estimasi", icon: Plus, primary: true },
  { href: "/servis", title: "Papan servis", desc: "Status kendaraan di bengkel", icon: ClipboardList },
  { href: "/kasir", title: "Kasir cepat", desc: "Jual part dan terima bayar", icon: ReceiptText },
  { href: "/inventory/scan", title: "Cek stok", desc: "Scan QR barang dan rak", icon: QrCode },
];

export function QuickActions({ allowed }: { allowed: (href: string) => boolean }) {
  const items = QUICK.filter((q) => allowed(q.href));
  if (items.length === 0) return null;
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ href, title, desc, icon: Icon, primary }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "group flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-brand-blue/60",
            primary ? "border-dashed border-brand-blue/60 bg-brand-blue-soft/40" : "border-border bg-card",
          )}
        >
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", primary ? "bg-brand-rail text-white" : "bg-brand-blue-soft text-brand-blue-fg")}>
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{desc}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </section>
  );
}

/* ================================================================ Kartu angka */
function StatTile({ eyebrow, tone, title, value, foot, href, cta, icon: Icon }: { eyebrow: string; tone: Tone; title: string; value: string; foot: string; href: string; cta: string; icon: LucideIcon }) {
  return (
    <div className={cn(panel, "flex flex-col gap-1 p-5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-2xs font-semibold tracking-wider uppercase", tone === "muted" ? "text-muted-foreground" : TONE[tone].split(" ")[1])}>{eyebrow}</p>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-2 text-[28px] leading-tight font-semibold tabular-nums">{value}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{foot}</span>
        <TextLink href={href}>{cta}</TextLink>
      </div>
    </div>
  );
}

export function StatTiles({ data }: { data: DashboardData }) {
  const { workOrders: wo, revenue, receivable, lowStock } = data;
  const tiles: React.ReactNode[] = [];
  if (wo)
    tiles.push(
      <StatTile key="wo" eyebrow="Hari ini" tone="blue" title="Work order aktif" value={`${wo.active} WO`} foot={wo.overdue > 0 ? `${wo.overdue} melewati estimasi` : "Tidak ada yang terlambat"} href="/servis" cta="Papan servis" icon={ClipboardList} />,
    );
  if (revenue)
    tiles.push(
      <StatTile key="rev" eyebrow="Bulan ini" tone="green" title="Omzet penjualan" value={rupiahShort(revenue.month)} foot={`${revenue.count} transaksi diposting`} href="/keuangan/laporan" cta="Laporan" icon={Wallet} />,
    );
  if (receivable)
    tiles.push(
      <StatTile key="ar" eyebrow="Piutang" tone="sand" title="Piutang pelanggan" value={rupiahShort(receivable.outstanding)} foot={receivable.invoices > 0 ? `${receivable.invoices} invoice belum lunas` : "Semua lunas"} href="/kasir/piutang" cta="Tagih" icon={ReceiptText} />,
    );
  if (lowStock)
    tiles.push(
      <StatTile key="low" eyebrow="Stok" tone={lowStock.count > 0 ? "red" : "muted"} title="Barang menipis" value={`${lowStock.count} barang`} foot={lowStock.rows[0] ? `${lowStock.rows[0].name} sisa ${lowStock.rows[0].qty}` : "Stok aman"} href="/pembelian" cta="Buat PO" icon={AlertTriangle} />,
    );
  if (tiles.length === 0) return null;
  return <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{tiles}</section>;
}

/* ================================================================ Work order aktif */
function WoRow({ w }: { w: DashWorkOrder }) {
  return (
    <Link href={`/servis/${w.id}`} className="grid gap-x-4 gap-y-1.5 border-t border-border px-5 py-3.5 transition-colors first:border-t-0 hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_120px_100px_130px_120px] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{w.services || w.complaint || "Belum ada jasa"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {w.wo_no}
          {w.vehicle_label ? ` · ${w.vehicle_label}` : ""}
        </p>
      </div>
      <span className="w-fit rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs font-medium">{w.plate_no}</span>
      <span className="truncate text-sm text-muted-foreground">{w.mechanics || "Belum ada mekanik"}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(w.minutes_in_status)} di status ini</span>
      <span className="flex flex-wrap gap-1">
        <Badge tone={STATUS_TONE[w.status]}>{WO_STATUS_LABEL[w.status]}</Badge>
        {w.is_overdue && <Badge tone="red">Terlambat</Badge>}
      </span>
    </Link>
  );
}

export function ActiveWorkOrders({ data }: { data: NonNullable<DashboardData["workOrders"]> }) {
  return (
    <section className={cn(panel, "flex flex-col p-0 xl:col-span-2")}>
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold">Work order aktif</h2>
        <TextLink href="/servis">Buka papan servis</TextLink>
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_100px_130px_120px] gap-4 border-y border-border bg-muted/50 px-5 py-2 text-2xs font-semibold tracking-wider text-muted-foreground uppercase md:grid">
        <span>Pekerjaan</span>
        <span>Kendaraan</span>
        <span>Mekanik</span>
        <span>Durasi</span>
        <span>Status</span>
      </div>
      {data.rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Tidak ada work order aktif.</p>
      ) : (
        <div>
          {data.rows.map((w) => (
            <WoRow key={w.id} w={w} />
          ))}
        </div>
      )}
      <p className="mt-auto border-t border-border px-5 py-3 text-xs text-muted-foreground">
        {data.active > data.rows.length ? `Menampilkan ${data.rows.length} dari ${data.active} work order aktif` : `${data.active} work order aktif`}
      </p>
    </section>
  );
}

/* ================================================================ Notifikasi */
const SEV_ICON: Record<Severity, { icon: LucideIcon; tone: Tone }> = {
  danger: { icon: AlertTriangle, tone: "red" },
  warn: { icon: AlertTriangle, tone: "sand" },
  info: { icon: Info, tone: "blue" },
};

export function NotificationsPanel({ data }: { data: NonNullable<DashboardData["notifications"]> }) {
  return (
    <section className={panel}>
      <CardHead title="Notifikasi" hint={data.unread > 0 ? `${data.unread} belum dibaca` : "Semua sudah dibaca"}>
        <TextLink href="/notifikasi">Semua</TextLink>
      </CardHead>
      {data.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
      ) : (
        <ul className="grid">
          {data.items.map((n) => {
            const { icon: Icon, tone } = SEV_ICON[n.severity] ?? SEV_ICON.info;
            const unread = !data.lastReadAt || n.created_at > data.lastReadAt;
            const body = (
              <>
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE[tone])}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                  <span className="block text-2xs text-muted-foreground">
                    {timeAgo(n.created_at)}
                    {n.actor_name ? ` · ${n.actor_name}` : ""}
                  </span>
                </span>
                {unread && <span aria-label="Belum dibaca" className="mt-1 size-2 shrink-0 rounded-full bg-brand-blue" />}
              </>
            );
            return (
              <li key={n.id} className="border-t border-border first:border-t-0">
                {n.link ? (
                  <Link href={n.link} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-muted/50">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ================================================================ Beban mekanik */
export function MechanicLoad({ rows, active }: { rows: { name: string; count: number }[]; active: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className={panel}>
      <CardHead title="Beban mekanik" hint="Work order aktif per mekanik">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-blue-soft text-brand-blue-fg">
          <Wrench className="size-[18px]" />
        </span>
      </CardHead>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{active > 0 ? "Belum ada mekanik ditugaskan." : "Tidak ada work order aktif."}</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.name} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{r.count} WO</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand-rail" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ================================================================ Barang menipis */
export function LowStockPanel({ data }: { data: NonNullable<DashboardData["lowStock"]> }) {
  return (
    <section className={panel}>
      <CardHead title={`${data.count} barang menipis`} hint="Buat PO sebelum stok habis">
        {data.count > 0 && <Badge tone="red">Stok</Badge>}
      </CardHead>
      {data.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Semua stok di atas batas minimum.</p>
      ) : (
        <ul className="grid">
          {data.rows.map((x) => (
            <li key={x.item_id} className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{x.name}</span>
                <span className="block truncate font-mono text-2xs text-muted-foreground">{x.sku}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-brand-red tabular-nums">
                  {x.qty} / {x.min_stock}
                </span>
                <span className="block text-2xs text-muted-foreground">sisa / min</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/pembelian" className="mt-4 flex h-10 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted">
        Buat purchase order
      </Link>
    </section>
  );
}

/* ================================================================ Kas shift */
export function ShiftPanel({ shift }: { shift: NonNullable<DashboardData["shift"]> | null }) {
  return (
    <section className={panel}>
      <CardHead title="Kas shift saya" hint={shift ? `${shift.shift_no} · kasir ${shift.cashier_name ?? "-"}` : "Belum ada shift terbuka"}>
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-green-soft text-brand-green">
          <Wallet className="size-[18px]" />
        </span>
      </CardHead>
      {shift ? (
        <>
          <p className="text-xs text-muted-foreground">Kas seharusnya</p>
          <p className="text-2xl font-semibold tabular-nums">{formatRupiah(shift.expected_now)}</p>
          <div className="mt-3 grid gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">Masuk tunai</span>
              <span className="font-medium tabular-nums">{formatRupiah(shift.cash_in)}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">Transfer / QRIS / kartu</span>
              <span className="font-medium tabular-nums">{formatRupiah(shift.non_cash_in)}</span>
            </p>
          </div>
        </>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">Buka shift untuk mulai menerima pembayaran di kasir.</p>
      )}
      <Link href="/kasir/shift" className="mt-4 flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90">
        {shift ? "Kelola shift" : "Buka shift"}
      </Link>
    </section>
  );
}
