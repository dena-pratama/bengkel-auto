import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { ListFilter } from "@/components/list-filter";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { listPurchaseOrders, listSuppliers } from "@/lib/purchasing";
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
    // Pemegang izin hutang saja tetap bisa ke halaman hutang
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
  const suppliers = await listSuppliers();
  const supplier = readOption(sp, "supplier", suppliers.map((s) => s.id));
  const [pos, receipt] = await Promise.all([listPurchaseOrders({ from: range.from, to: range.to, status, supplier }), canCreate ? receiptFormData(null) : Promise.resolve(null)]);
  const open = pos.filter((p) => p.status === "sent" || p.status === "partial").length;

  return (
    <>
      <PurchasingNav active="po" showPayables={can(ctx, "payables", "view", false)} />
      <PageHeader
        title="Purchase order"
        description={`${describeRange(range, formatDate)} · ${pos.length} PO · ${open} menunggu barang datang`}
        actions={
          receipt && (
            <>
              <NewReceiptDialog data={receipt} canPay={can(ctx, "payables", "create", false)} label="Terima tanpa PO" variant="outline" />
              <NewPoDialog suppliers={receipt.suppliers} items={receipt.items} today={todayWib()} />
            </>
          )
        }
      />
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
      <section className={cn(panel, "p-4 sm:p-5")}>
        {pos.length === 0 ? (
          <EmptyState icon={ClipboardList} text="Belum ada PO. Buat PO saat stok menipis atau pesan barang ke supplier." />
        ) : (
          <ul className="grid divide-y divide-border">
            {pos.map((p) => (
              <li key={p.id}>
                <Link href={`/pembelian/po/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{p.po_no}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {p.supplier} · {p.lines} barang · {formatDate(p.order_date)}
                    </p>
                  </div>
                  <PoStatusBadge status={p.status} />
                  <span className="w-32 text-right font-semibold tabular-nums">{formatRupiah(p.total)}</span>
                  <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
