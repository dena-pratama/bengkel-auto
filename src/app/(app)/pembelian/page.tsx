import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ClipboardList, Clock, Package, Truck } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { ListFilter } from "@/components/list-filter";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { listApReceipts, listPurchaseOrders, listSuppliers } from "@/lib/purchasing";
import { PO_STATUS_LABEL } from "@/lib/validation/purchasing";
import { cn } from "@/lib/utils";
import { NewPoDialog, NewReceiptDialog } from "./_components/dialogs";
import { PoStatusBadge, PurchasingNav } from "./_components/ui";
import { receiptFormData } from "./receipt-data";

export default function PurchaseOrdersPage({ searchParams }: PageProps<"/pembelian">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "purchasing", "view", false)) {
    return can(ctx, "payables", "view", false) ? (
      <section className={panel}>
        <Link href="/pembelian/hutang" className="font-medium text-brand-blue-fg hover:underline">
          Buka daftar hutang supplier →
        </Link>
      </section>
    ) : (
      <NoAccess />
    );
  }
  const canCreate = can(ctx, "purchasing", "create", false);
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "tahun-ini");
  const statuses = Object.keys(PO_STATUS_LABEL) as (keyof typeof PO_STATUS_LABEL)[];
  const status = readOption(sp, "status", statuses);
  const [suppliers, ap] = await Promise.all([listSuppliers(), listApReceipts(true)]);
  const supplier = readOption(sp, "supplier", suppliers.map((s) => s.id));
  const [pos, receipt] = await Promise.all([
    listPurchaseOrders({ from: range.from, to: range.to, status, supplier }),
    canCreate ? receiptFormData(null) : Promise.resolve(null),
  ]);

  const monthPrefix = today.slice(0, 7);
  const thisMonthPos = pos.filter((p) => p.order_date.startsWith(monthPrefix));
  const thisMonthTotal = thisMonthPos.reduce((sum, p) => sum + p.total, 0);
  const waitingPos = pos.filter((p) => p.status === "sent" || p.status === "partial");
  const waitingTotal = waitingPos.reduce((sum, p) => sum + p.total, 0);
  const dueAp = ap.filter((a) => a.days_overdue != null && a.days_overdue >= -7);
  const dueTotal = dueAp.reduce((sum, a) => sum + a.outstanding, 0);
  const activeSuppliers = suppliers.filter((s) => s.is_active).length;

  return (
    <>
      <PurchasingNav active="po" showPayables={can(ctx, "payables", "view", false)} />
      <PageHeader
        title="Purchase order & pembelian"
        description={`${describeRange(range, formatDate)} · ${pos.length} PO · ${waitingPos.length} menunggu barang datang`}
        actions={
          receipt && (
            <div className="flex flex-wrap gap-2">
              <NewReceiptDialog data={receipt} canPay={can(ctx, "payables", "create", false)} label="Terima tanpa PO" variant="outline" />
              <NewPoDialog suppliers={receipt.suppliers} items={receipt.items} today={todayWib()} />
            </div>
          )
        }
      />

      {/* Summary 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Pembelian bulan ini */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
            <Package className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Pembelian bulan ini</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{formatRupiah(thisMonthTotal)}</p>
            <p className="text-[11px] text-muted-foreground">{thisMonthPos.length} PO tercatat</p>
          </div>
        </section>

        {/* Menunggu datang */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
            <Clock className="size-5 text-brand-sand" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Menunggu datang</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{waitingPos.length} PO</p>
            <p className="text-[11px] text-muted-foreground">{formatRupiah(waitingTotal)}</p>
          </div>
        </section>

        {/* Hutang jatuh tempo */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
            <AlertTriangle className="size-5 text-brand-red" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Hutang jatuh tempo</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{formatRupiah(dueTotal)}</p>
            <p className="text-[11px] text-muted-foreground">{dueAp.length} tagihan &le; 7 hari</p>
          </div>
        </section>

        {/* Supplier aktif */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
            <Truck className="size-5 text-brand-green" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Supplier aktif</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{activeSuppliers}</p>
            <p className="text-[11px] text-muted-foreground">dari {suppliers.length} rekanan</p>
          </div>
        </section>
      </div>

      <ListFilter
        today={today}
        range={range}
        defaultRange="tahun-ini"
        dateLabel="Tanggal PO"
        selects={[
          { name: "status", label: "Status", value: status, options: statuses.map((v) => ({ value: v, label: PO_STATUS_LABEL[v] })), allLabel: "Semua status" },
          { name: "supplier", label: "Supplier", value: supplier, options: suppliers.map((s) => ({ value: s.id, label: s.name })), allLabel: "Semua supplier" },
        ]}
      />

      {/* Card/Daftar PO */}
      <section className={cn(panel, "overflow-hidden p-0")}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold">Daftar purchase order</h2>
          </div>
          <span className="text-xs text-muted-foreground">{pos.length} transaksi</span>
        </div>
        {pos.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState icon={ClipboardList} text="Belum ada PO. Buat PO saat stok menipis atau pesan barang ke supplier." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">PURCHASE ORDER</th>
                  <th className="px-3 py-2.5 font-medium">SUPPLIER</th>
                  <th className="px-3 py-2.5 text-right font-medium">BARANG</th>
                  <th className="px-3 py-2.5 font-medium">TANGGAL</th>
                  <th className="px-3 py-2.5 font-medium">STATUS</th>
                  <th className="px-5 py-2.5 text-right font-medium">TOTAL</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pos.map((p) => (
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
                      <Link href={`/pembelian/po/${p.id}`} aria-label={`Detail ${p.po_no}`}>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
