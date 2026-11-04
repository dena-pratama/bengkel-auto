import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ClipboardList, Clock, Package, Truck } from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { PoListRow } from "@/lib/purchasing";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PoStatusBadge, PurchasingNav } from "@/app/(app)/pembelian/_components/ui";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Purchasing", position: "Purchasing", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "purchasing", name: "Purchasing" }],
  permissions: [],
};

const SAMPLE_POS: PoListRow[] = [
  {
    id: "po-1",
    po_no: "PO-2611-0008",
    supplier_id: "sup-1",
    supplier: "PT Sumber Part",
    order_date: "2026-11-04",
    expected_date: "2026-11-06",
    status: "draft",
    total: 1540000,
    lines: 2,
  },
  {
    id: "po-2",
    po_no: "PO-2611-0007",
    supplier_id: "sup-1",
    supplier: "PT Sumber Part",
    order_date: "2026-11-03",
    expected_date: "2026-11-05",
    status: "sent",
    total: 4380000,
    lines: 3,
  },
  {
    id: "po-3",
    po_no: "PO-2611-0006",
    supplier_id: "sup-2",
    supplier: "CV Ban Jaya",
    order_date: "2026-11-02",
    expected_date: "2026-11-04",
    status: "partial",
    total: 2800000,
    lines: 2,
  },
  {
    id: "po-4",
    po_no: "PO-2611-0005",
    supplier_id: "sup-3",
    supplier: "PT Oli Nusantara",
    order_date: "2026-10-28",
    expected_date: "2026-10-30",
    status: "received",
    total: 3120000,
    lines: 4,
  },
];

export default function PurchasingPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau pembelian...</div>}>
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
        <PurchasingNav active="po" showPayables={true} />
        <PageHeader
          title="Purchase order & pembelian"
          description="Bulan ini · 4 PO · 2 menunggu barang datang"
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
                Terima tanpa PO
              </button>
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-rail px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-rail/90">
                Buat PO baru
              </button>
            </div>
          }
        />

        {/* Summary 4 cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
              <Package className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pembelian bulan ini</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">{formatRupiah(11840000)}</p>
              <p className="text-[11px] text-muted-foreground">4 PO tercatat</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
              <Clock className="size-5 text-brand-sand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Menunggu datang</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">2 PO</p>
              <p className="text-[11px] text-muted-foreground">{formatRupiah(7180000)}</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
              <AlertTriangle className="size-5 text-brand-red" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Hutang jatuh tempo</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">{formatRupiah(3700000)}</p>
              <p className="text-[11px] text-muted-foreground">2 tagihan &le; 7 hari</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
              <Truck className="size-5 text-brand-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Supplier aktif</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">12</p>
              <p className="text-[11px] text-muted-foreground">3 dipakai bulan ini</p>
            </div>
          </section>
        </div>

        {/* Card/Daftar PO */}
        <section className={cn(panel, "overflow-hidden p-0")}>
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold">Daftar purchase order</h2>
            </div>
            <span className="text-xs text-muted-foreground">{SAMPLE_POS.length} transaksi</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">PURCHASE ORDER</th>
                  <th className="px-3 py-2.5 font-medium">SUPPLIER</th>
                  <th className="px-3 py-2.5 text-right font-medium">BARANG</th>
                  <th className="px-3 py-2.5 text-sm font-medium">TANGGAL</th>
                  <th className="px-3 py-2.5 font-medium">STATUS</th>
                  <th className="px-5 py-2.5 text-right font-medium">TOTAL</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SAMPLE_POS.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-mono text-sm font-semibold">
                      <Link href={`/pembelian/po/${p.id}`} className="hover:underline">
                        {p.po_no}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-sm text-muted-foreground">
                      {p.supplier}
                    </td>
                    <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                      {p.lines} barang
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {formatDate(p.order_date)}
                    </td>
                    <td className="px-3 py-3">
                      <PoStatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {formatRupiah(p.total)}
                    </td>
                    <td className="px-2 text-right">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
