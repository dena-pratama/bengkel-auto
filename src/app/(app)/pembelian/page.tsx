import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { listPurchaseOrders } from "@/lib/purchasing";
import { cn } from "@/lib/utils";
import { NewPoDialog, NewReceiptDialog } from "./_components/dialogs";
import { PoStatusBadge, PurchasingNav } from "./_components/ui";
import { receiptFormData } from "./receipt-data";

export default function PurchaseOrdersPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
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
  const [pos, receipt] = await Promise.all([listPurchaseOrders(), canCreate ? receiptFormData(null) : Promise.resolve(null)]);
  const open = pos.filter((p) => p.status === "sent" || p.status === "partial").length;

  return (
    <>
      <PurchasingNav active="po" showPayables={can(ctx, "payables", "view", false)} />
      <PageHeader
        title="Purchase order"
        description={`${open} PO menunggu barang datang`}
        actions={
          receipt && (
            <>
              <NewReceiptDialog data={receipt} canPay={can(ctx, "payables", "create", false)} label="Terima tanpa PO" variant="outline" />
              <NewPoDialog suppliers={receipt.suppliers} items={receipt.items} today={todayWib()} />
            </>
          )
        }
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
