import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, PackageCheck } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah } from "@/lib/format";
import { listReceipts } from "@/lib/purchasing";
import { cn } from "@/lib/utils";
import { NewReceiptDialog } from "../_components/dialogs";
import { PurchasingNav } from "../_components/ui";
import { receiptFormData } from "../receipt-data";

export default function ReceiptsPage() {
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
  if (!can(ctx, "purchasing", "view", false) && !can(ctx, "payables", "view", false)) return <NoAccess />;
  const canCreate = can(ctx, "purchasing", "create", false);
  const [receipts, form] = await Promise.all([listReceipts(), canCreate ? receiptFormData(null) : Promise.resolve(null)]);

  return (
    <>
      <PurchasingNav active="receipts" showPayables={can(ctx, "payables", "view", false)} />
      <PageHeader
        title="Penerimaan barang"
        description="Barang hanya bertambah lewat penerimaan yang tercatat."
        actions={
          form && <NewReceiptDialog data={form} canPay={can(ctx, "payables", "create", false)} label="Terima barang" />
        }
      />
      <section className={cn(panel, "p-4 sm:p-5")}>
        {receipts.length === 0 ? (
          <EmptyState icon={PackageCheck} text="Belum ada penerimaan barang." />
        ) : (
          <ul className="grid divide-y divide-border">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link href={`/pembelian/penerimaan/${r.id}`} className="flex items-center gap-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{r.gr_no}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.supplier} · {formatDate(r.receipt_date)}
                      {r.invoice_no && ` · Faktur ${r.invoice_no}`}
                      {r.po_no && ` · ${r.po_no}`}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatRupiah(r.total)}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
