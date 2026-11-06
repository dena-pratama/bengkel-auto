import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  PauseCircle,
  QrCode,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { CashierNav, PaidBadge } from "@/app/(app)/kasir/_components/ui";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Sinta Kasir", position: "Kasir", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "cashier", name: "Kasir" }],
  permissions: [],
};

export default function KasirPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau kasir...</div>}>
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
        <CashierNav active="cashier" />
        <PageHeader
          title="Kasir"
          description="Penjualan part langsung dan tagihan work order, semua uang masuk tercatat di shift."
          actions={
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-rail px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-rail/90">
              Penjualan baru
            </button>
          }
        />

        {/* Card/Shift */}
        <section className={panel}>
          <div className="grid gap-5">
            {/* Header shift */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-[10px] bg-brand-green-soft">
                  <Wallet className="size-5 text-brand-green" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] font-semibold leading-6">Shift SH-2611-0004</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green">
                      <span className="size-1.5 rounded-full bg-brand-green" />
                      Terbuka
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">Dibuka 4 Nov 2026, 07.55 WIB · Kasir: Sinta</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
                  Kas keluar
                </button>
                <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-rail px-4 text-sm font-semibold text-white hover:bg-brand-rail/90">
                  Tutup shift
                </button>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {/* Kas seharusnya - highlight biru */}
              <div className="order-first col-span-2 rounded-[10px] bg-brand-blue-soft p-4 sm:order-4 sm:col-span-1">
                <p className="text-xs font-medium text-brand-blue-fg">Kas seharusnya</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-brand-blue-fg">{formatRupiah(4820000)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Modal + tunai - keluar</p>
              </div>
              {/* Modal awal */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-1">
                <p className="text-xs font-medium text-muted-foreground">Modal awal</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(500000)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Setoran awal</p>
              </div>
              {/* Tunai masuk */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-2">
                <p className="text-xs font-medium text-muted-foreground">Tunai masuk</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(4470000)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">18 transaksi</p>
              </div>
              {/* Kas keluar */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-3">
                <p className="text-xs font-medium text-muted-foreground">Kas keluar</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(150000)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">1 pengeluaran</p>
              </div>
              {/* Non-tunai */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-5">
                <p className="text-xs font-medium text-muted-foreground">Non-tunai</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(1670000)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">QRIS & transfer</p>
              </div>
            </div>

            {/* Methods row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3">
              <span className="text-xs font-medium text-muted-foreground">Pembayaran hari ini</span>
              <span className="flex items-center gap-1.5 text-xs">
                <Banknote className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Tunai</span>
                <span className="font-semibold tabular-nums">{formatRupiah(4470000)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <QrCode className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">QRIS</span>
                <span className="font-semibold tabular-nums">{formatRupiah(1120000)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <Receipt className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Transfer</span>
                <span className="font-semibold tabular-nums">{formatRupiah(550000)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <CreditCard className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Kartu</span>
                <span className="font-semibold tabular-nums">{formatRupiah(0)}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Row/Content */}
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          {/* Left column */}
          <div className="grid content-start gap-5">
            {/* Siap ditagih */}
            <section className={panel}>
              <div className="flex items-center justify-between gap-3 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="size-4 text-muted-foreground" />
                    <h2 className="text-[15px] font-semibold">Siap ditagih</h2>
                    <span className="rounded-full bg-brand-blue-soft px-2 py-0.5 text-xs font-medium text-brand-blue-fg">
                      3
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">Work order selesai yang menunggu pembayaran</p>
                </div>
                <Link href="/servis" className="text-[13px] font-semibold text-brand-blue-fg hover:underline">
                  Lihat semua
                </Link>
              </div>
              <div className="-mx-5 -mb-5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">WORK ORDER</th>
                      <th className="px-3 py-2.5 font-medium">PELANGGAN</th>
                      <th className="px-3 py-2.5 text-right font-medium">ITEM</th>
                      <th className="px-3 py-2.5 text-right font-medium">TOTAL</th>
                      <th className="px-5 py-2.5 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { wo: "WO-2611-0010", plate: "B 3301 NNA", name: "Ibu Maya", item: 5, total: 865000 },
                      { wo: "WO-2611-0008", plate: "B 7781 KZA", name: "PT Sinar Fleet", item: 9, total: 2340000 },
                      { wo: "WO-2611-0006", plate: "D 1288 XB", name: "Bp. Hendra", item: 4, total: 650000 },
                    ].map((row) => (
                      <tr key={row.wo} className="hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <p className="font-mono text-sm font-semibold">{row.wo}</p>
                          <p className="text-xs text-muted-foreground">{row.plate}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{row.name}</td>
                        <td className="px-3 py-3 text-right text-sm text-muted-foreground">{row.item} item</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatRupiah(row.total)}</td>
                        <td className="px-5 py-3 text-right">
                          <button type="button" className="inline-flex h-8 items-center rounded-lg bg-brand-rail px-3 text-xs font-semibold text-white hover:bg-brand-rail/90">
                            Tagih
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Transaksi terakhir */}
            <section className={panel}>
              <div className="flex items-center justify-between gap-3 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4 text-muted-foreground" />
                    <h2 className="text-[15px] font-semibold">Transaksi terakhir</h2>
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">Hari ini · 4 transaksi</p>
                </div>
                <Link href="/kasir/penjualan" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue-fg hover:underline">
                  Penjualan & invoice <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
              <div className="-mx-5 -mb-5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">INVOICE</th>
                      <th className="px-3 py-2.5 font-medium">PELANGGAN</th>
                      <th className="px-3 py-2.5 font-medium">METODE</th>
                      <th className="px-3 py-2.5 font-medium">STATUS</th>
                      <th className="px-5 py-2.5 text-right font-medium">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { inv: "INV-2611-0023", cust: "Bp. Agus · WO-2611-0018", method: "QRIS", total: 1480000, paid: true },
                      { inv: "INV-2611-0022", cust: "Umum · 2 item", method: "Tunai", total: 95000, paid: true },
                      { inv: "INV-2611-0021", cust: "PT Sinar Fleet", method: "Transfer", total: 3150000, paid: false },
                      { inv: "INV-2611-0020", cust: "Ibu Sari · WO-2611-0011", method: "Tunai", total: 720000, paid: true },
                    ].map((row) => (
                      <tr key={row.inv} className="hover:bg-muted/30">
                        <td className="px-5 py-3 font-mono text-sm font-semibold">{row.inv}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{row.cust}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{row.method}</td>
                        <td className="px-3 py-3">
                          <PaidBadge total={row.total} outstanding={row.paid ? 0 : row.total} overdue={null} />
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatRupiah(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="grid content-start gap-5">
            {/* Transaksi ditahan */}
            <section className={panel}>
              <div className="flex items-center gap-2 pb-1">
                <PauseCircle className="size-4 text-muted-foreground" />
                <h2 className="text-[15px] font-semibold">Transaksi ditahan</h2>
                <span className="rounded-full bg-brand-sand-soft px-2 py-0.5 text-xs font-medium text-foreground">
                  2
                </span>
              </div>
              <p className="pb-4 text-[13px] text-muted-foreground">Lanjutkan sebelum tutup shift</p>
              <ul className="grid gap-2">
                {[
                  { name: "Umum", items: "3 item · oli & filter", total: 340000 },
                  { name: "Bp. Hendra", items: "Menunggu persetujuan estimasi", total: 1250000 },
                ].map((item) => (
                  <li key={item.name} className="flex items-center gap-3 rounded-[10px] bg-muted/40 p-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-sand-soft">
                      <PauseCircle className="size-4 text-brand-sand" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.items}</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums">{formatRupiah(item.total)}</p>
                    </div>
                    <button type="button" className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted">
                      Lanjutkan
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Aksi cepat */}
            <section className={panel}>
              <h2 className="pb-3 text-[15px] font-semibold">Aksi cepat</h2>
              <ul className="grid gap-1">
                {[
                  { icon: ShoppingCart, label: "Jual part langsung", sub: "Tanpa work order", href: "/kasir" },
                  { icon: Receipt, label: "Tagih work order", sub: "3 WO siap ditagih", href: "/servis" },
                  { icon: Wallet, label: "Terima pembayaran piutang", sub: "1 invoice belum lunas", href: "/kasir/piutang" },
                  { icon: RotateCcw, label: "Retur penjualan", sub: "Barang kembali", href: "/kasir/retur" },
                ].map(({ icon: Icon, label, sub, href }) => (
                  <li key={label}>
                    <Link href={href} className="flex items-center gap-3 rounded-[10px] px-3 py-3.5 transition-colors hover:bg-muted/50">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft">
                        <Icon className="size-4 text-brand-blue-fg" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
