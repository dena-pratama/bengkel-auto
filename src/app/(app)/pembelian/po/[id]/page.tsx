import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import { getPurchaseOrder, listItemOptions, listSuppliers } from "@/lib/purchasing";
import { cn } from "@/lib/utils";
import { NewReceiptDialog } from "../../_components/dialogs";
import { PoActions } from "../../_components/po-actions";
import { receiptFormData } from "../../receipt-data";
import { PoForm } from "../../_components/po-form";
import { PoStatusBadge, UUID } from "../../_components/ui";

export default function PoDetailPage({ params }: PageProps<"/pembelian/po/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "purchasing", "view", false)) return <NoAccess />;
  const po = await getPurchaseOrder(id);
  if (!po) notFound();
  const canUpdate = can(ctx, "purchasing", "update", false);
  const editable = po.status === "draft" && canUpdate;
  const total = po.items.reduce((t, i) => t + i.qty * i.unit_price, 0);

  return (
    <>
      <PageHeader title={po.po_no} description={`${po.supplier} · ${formatDate(po.order_date)}`} back={{ href: "/pembelian", label: "Purchase order" }} />
      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center gap-3">
          <PoStatusBadge status={po.status} />
          {po.expected_date && <span className="text-sm text-muted-foreground">Perkiraan datang {formatDate(po.expected_date)}</span>}
          {po.cancel_reason && <span className="text-sm text-brand-red">Alasan batal: {po.cancel_reason}</span>}
        </div>
        <PoActions
          id={po.id}
          status={po.status}
          canUpdate={canUpdate}
          receive={
            can(ctx, "purchasing", "create", false) && (po.status === "sent" || po.status === "partial") ? (
              <NewReceiptDialog data={await receiptFormData(po.id)} canPay={can(ctx, "payables", "create", false)} label="Terima barang" />
            ) : null
          }
        />
      </section>

      {editable ? (
        <PoForm
          key={po.id}
          id={po.id}
          suppliers={await listSuppliers()}
          items={await listItemOptions()}
          defaults={{
            supplier_id: po.supplier_id,
            order_date: po.order_date,
            expected_date: po.expected_date ?? "",
            notes: po.notes ?? "",
            items: po.items.map((i) => ({ item_id: i.item_id, unit_id: i.unit_id, qty: String(i.qty), unit_price: String(i.unit_price) })),
          }}
        />
      ) : (
        <section className={cn(panel, "grid gap-3")}>
          <h2 className="text-lg font-semibold">Barang dipesan</h2>
          <ul className="grid divide-y divide-border">
            {po.items.map((i) => {
              const orderedBase = i.qty * i.factor;
              const pct = Math.min(100, Math.round((i.received_base_qty / orderedBase) * 100));
              return (
                <li key={i.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_200px_140px] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.item_name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{i.sku}</span> · {formatQty(i.qty)} {i.unit} × {formatRupiah(i.unit_price)}
                    </p>
                  </div>
                  <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Diterima {formatQty(i.received_base_qty)} / {formatQty(orderedBase)} {i.base_unit}
                    </p>
                    <span className="h-1.5 rounded-full bg-brand-blue-soft">
                      <span className="block h-full rounded-full bg-brand-blue-ink" style={{ width: `${pct}%` }} />
                    </span>
                  </div>
                  <span className="text-right font-semibold tabular-nums">{formatRupiah(i.qty * i.unit_price)}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-3 border-t border-border pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-bold tabular-nums">{formatRupiah(total)}</span>
          </div>
          {po.notes && <p className="text-sm text-muted-foreground">Catatan: {po.notes}</p>}
        </section>
      )}
    </>
  );
}
