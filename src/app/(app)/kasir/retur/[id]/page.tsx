import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getSaleReturn } from "@/lib/cashier";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import { CONDITION_LABEL, SETTLEMENT_LABEL } from "@/lib/validation/cashier";
import { cn } from "@/lib/utils";
import { CashierNav, UUID } from "../../_components/ui";

export default function SaleReturnDetailPage({ params }: PageProps<"/kasir/retur/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <div className="print:hidden">
        <CashierNav active="returns" />
      </div>
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
  if (!can(ctx, "sales", "view", false) && !can(ctx, "receivables", "view", false)) return <NoAccess />;
  const ret = await getSaleReturn(id);
  if (!ret) notFound();

  return (
    <>
      <PageHeader
        title={ret.return_no}
        description={[
          `Nota ${ret.sale_no ?? ""}`,
          ret.customer_name ?? "Umum",
          ret.plate_no,
          formatDate(ret.return_date),
        ]
          .filter(Boolean)
          .join(" · ")}
        back={{ href: "/kasir/retur", label: "Retur penjualan" }}
      />

      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-sm bg-brand-red-soft px-2.5 py-1 text-xs font-semibold text-brand-red">
            {ret.return_no}
          </span>
          <span className="rounded-sm bg-brand-sand-soft px-2.5 py-1 text-xs font-medium">
            {SETTLEMENT_LABEL[ret.settlement]}
          </span>
          {ret.sale_id && (
            <Link
              href={`/kasir/penjualan/${ret.sale_id}`}
              className="font-medium text-brand-blue-fg hover:underline"
            >
              Buka nota asli ({ret.sale_no ?? "-"}) →
            </Link>
          )}
        </div>
        <div className="grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Alasan retur</p>
            <p className="font-medium text-foreground">{ret.reason}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Penyelesaian dana</p>
            <p className="font-medium text-foreground">
              {ret.settlement === "debt"
                ? "Potong sisa piutang nota pelanggan"
                : ret.payment_method === "cash"
                  ? `Uang kembali tunai via shift kasir (${ret.shift_no ?? "shift aktif"})`
                  : `Transfer bank via ${ret.cash_bank_account_name ?? "akun bank"}`}
            </p>
          </div>
        </div>
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Rincian Barang yang Diretur</h2>
        <ul className="grid divide-y divide-border">
          {ret.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.item_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  SKU: {item.item_sku} · {formatQty(item.qty)} {item.base_unit} × {formatRupiah(item.unit_price)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 font-medium",
                      item.condition === "damaged"
                        ? "bg-brand-red-soft text-brand-red"
                        : "bg-brand-blue-soft text-brand-blue-fg",
                    )}
                  >
                    {CONDITION_LABEL[item.condition]}
                  </span>
                  <span className="text-muted-foreground">
                    Lokasi: {item.location_code} ({item.location_name})
                  </span>
                </div>
              </div>
              <span className="font-semibold tabular-nums text-foreground">{formatRupiah(item.line_total)}</span>
            </li>
          ))}
        </ul>

        <dl className="ml-auto grid min-w-64 grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-border pt-3 text-sm tabular-nums">
          <dt className="text-muted-foreground">Subtotal retur</dt>
          <dd className="text-right">{formatRupiah(ret.amount)}</dd>
          {ret.ppn_amount > 0 && (
            <>
              <dt className="text-muted-foreground">PPN dibalik</dt>
              <dd className="text-right">{formatRupiah(ret.ppn_amount)}</dd>
            </>
          )}
          <dt className="font-medium">Total retur</dt>
          <dd className="text-right text-xl font-bold text-brand-red">{formatRupiah(ret.total)}</dd>
        </dl>
      </section>
    </>
  );
}
