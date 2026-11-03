import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah } from "@/lib/format";
import { getSupplier, listApReceipts, listPurchaseOrders, listReceipts } from "@/lib/purchasing";
import { cn } from "@/lib/utils";
import { SupplierForm } from "../../_components/supplier-form";
import { DueBadge, PoStatusBadge, UUID } from "../../_components/ui";

export default function SupplierDetailPage({ params }: PageProps<"/pembelian/supplier/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
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
  const canPurchasing = can(ctx, "purchasing", "view", false);
  const canPayables = can(ctx, "payables", "view", false);
  if (!canPurchasing && !canPayables) return <NoAccess />;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();
  const [pos, receipts, ap] = await Promise.all([
    canPurchasing ? listPurchaseOrders() : Promise.resolve([]),
    listReceipts(),
    canPayables ? listApReceipts() : Promise.resolve([]),
  ]);
  const myPos = pos.filter((p) => p.supplier_id === supplier.id).slice(0, 10);
  const myReceipts = receipts.filter((r) => r.supplier_id === supplier.id).slice(0, 10);
  const myAp = ap.filter((r) => r.supplier_id === supplier.id);
  const debt = myAp.reduce((t, r) => t + r.outstanding, 0);

  return (
    <>
      <PageHeader title={supplier.name} description={`${supplier.code}${supplier.is_active ? "" : " · Nonaktif"}`} back={{ href: "/pembelian/supplier", label: "Supplier" }} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SupplierForm
          key={supplier.id}
          id={supplier.id}
          readOnly={!can(ctx, "purchasing", "update", false)}
          isActive={supplier.is_active}
          defaults={{
            name: supplier.name,
            contact_name: supplier.contact_name ?? "",
            phone: supplier.phone ?? "",
            email: supplier.email ?? "",
            address: supplier.address ?? "",
            npwp: supplier.npwp ?? "",
            payment_terms_days: String(supplier.payment_terms_days),
            bank_name: supplier.bank_name ?? "",
            bank_account_number: supplier.bank_account_number ?? "",
            bank_account_name: supplier.bank_account_name ?? "",
            notes: supplier.notes ?? "",
          }}
        />
        <div className="grid content-start gap-4">
          {canPayables && (
            <section className={cn(panel, "grid gap-3")}>
              <div className="flex items-end justify-between gap-3">
                <h3 className="text-lg font-semibold">Sisa hutang</h3>
                <p className={cn("text-2xl font-bold tabular-nums", debt > 0 && "text-brand-red")}>{formatRupiah(debt)}</p>
              </div>
              <ul className="grid divide-y divide-border">
                {myAp.map((r) => (
                  <li key={r.receipt_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/pembelian/penerimaan/${r.receipt_id}`} className="font-mono font-medium hover:underline">
                      {r.gr_no}
                    </Link>
                    <DueBadge daysOverdue={r.days_overdue} />
                    <span className="font-semibold tabular-nums">{formatRupiah(r.outstanding)}</span>
                  </li>
                ))}
                {myAp.length === 0 && <li className="py-2 text-sm text-muted-foreground">Tidak ada hutang.</li>}
              </ul>
            </section>
          )}
          {canPurchasing && (
            <section className={cn(panel, "grid gap-3")}>
              <h3 className="text-lg font-semibold">PO terakhir</h3>
              <ul className="grid divide-y divide-border">
                {myPos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/pembelian/po/${p.id}`} className="font-mono font-medium hover:underline">
                      {p.po_no}
                    </Link>
                    <PoStatusBadge status={p.status} />
                    <span className="tabular-nums">{formatRupiah(p.total)}</span>
                  </li>
                ))}
                {myPos.length === 0 && <li className="py-2 text-sm text-muted-foreground">Belum ada PO.</li>}
              </ul>
            </section>
          )}
          <section className={cn(panel, "grid gap-3")}>
            <h3 className="text-lg font-semibold">Penerimaan terakhir</h3>
            <ul className="grid divide-y divide-border">
              {myReceipts.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/pembelian/penerimaan/${r.id}`} className="font-mono font-medium hover:underline">
                    {r.gr_no}
                  </Link>
                  <span className="text-muted-foreground">{formatDate(r.receipt_date)}</span>
                  <span className="tabular-nums">{formatRupiah(r.total)}</span>
                </li>
              ))}
              {myReceipts.length === 0 && <li className="py-2 text-sm text-muted-foreground">Belum ada penerimaan.</li>}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
