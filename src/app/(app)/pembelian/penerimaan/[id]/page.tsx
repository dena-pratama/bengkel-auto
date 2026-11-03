import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { getReceipt, listApReceipts, listCashBankAccounts } from "@/lib/purchasing";
import { cn } from "@/lib/utils";
import { ReturnForm } from "../../_components/return-form";
import { DueBadge, UUID } from "../../_components/ui";

export default function ReceiptDetailPage({ params }: PageProps<"/pembelian/penerimaan/[id]">) {
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
  const canPayables = can(ctx, "payables", "view", false);
  if (!can(ctx, "purchasing", "view", false) && !canPayables) return <NoAccess />;
  const gr = await getReceipt(id);
  if (!gr) notFound();
  const [ap, cashAccounts] = await Promise.all([canPayables ? listApReceipts(false) : Promise.resolve([]), listCashBankAccounts()]);
  const debt = ap.find((r) => r.receipt_id === gr.id);

  return (
    <>
      <PageHeader title={gr.gr_no} description={`${gr.supplier} · diterima ${formatDate(gr.receipt_date)}`} back={{ href: "/pembelian/penerimaan", label: "Penerimaan barang" }} />

      <section className={cn(panel, "grid gap-4 sm:grid-cols-2 lg:grid-cols-4")}>
        <Info label="No. faktur supplier" value={gr.invoice_no ?? "—"} />
        <Info label="Tanggal faktur" value={formatDate(gr.invoice_date)} />
        <Info label="Jatuh tempo" value={formatDate(gr.due_date)} />
        <Info
          label="Dari PO"
          value={
            gr.po ? (
              <Link href={`/pembelian/po/${gr.po.id}`} className="font-mono hover:underline">
                {gr.po.po_no}
              </Link>
            ) : (
              "Tanpa PO"
            )
          }
        />
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Barang</h2>
        <ul className="grid divide-y divide-border">
          {gr.items.map((i) => (
            <li key={i.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">{i.item_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatQty(i.qty)} {i.unit} × {formatRupiah(i.unit_price)}
                  {i.discount_amount > 0 && ` − diskon ${formatRupiah(i.discount_amount)}`} · +{formatQty(i.base_qty)} {i.base_unit} ke {i.location}
                  {i.returned_base_qty > 0 && (
                    <span className="text-brand-red">
                      {" "}
                      · diretur {formatQty(i.returned_base_qty)} {i.base_unit}
                    </span>
                  )}
                </p>
              </div>
              <span className="font-semibold tabular-nums sm:text-right">{formatRupiah(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto grid w-full max-w-sm gap-1 border-t border-border pt-3 text-sm">
          <Row label="Subtotal" value={formatRupiah(gr.subtotal)} />
          <Row label={gr.ppn_capitalized ? "PPN (masuk HPP)" : "PPN Masukan"} value={formatRupiah(gr.ppn_amount)} />
          <Row label="Total faktur" value={formatRupiah(gr.total)} strong />
          {debt && (
            <>
              <Row label="Sudah dibayar" value={formatRupiah(debt.paid)} />
              {debt.returned > 0 && <Row label="Dipotong retur" value={formatRupiah(debt.returned)} />}
              <div className="flex items-center justify-between pt-1">
                <dt className="font-medium">Sisa hutang</dt>
                <dd className="flex items-center gap-2">
                  {debt.outstanding > 0 && <DueBadge daysOverdue={debt.days_overdue} />}
                  <span className={cn("text-lg font-bold tabular-nums", debt.outstanding > 0 && "text-brand-red")}>{formatRupiah(debt.outstanding)}</span>
                </dd>
              </div>
            </>
          )}
        </dl>
        {gr.notes && <p className="text-sm text-muted-foreground">Catatan: {gr.notes}</p>}
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Retur ke supplier</h2>
        {gr.returns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada retur.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {gr.returns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-mono font-medium">{r.return_no}</span> · {formatDate(r.return_date)} · {r.reason}
                </span>
                <span className="tabular-nums">
                  {r.settlement === "debt" ? "Potong hutang" : "Uang kembali"} {formatRupiah(r.amount + r.ppn_amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {can(ctx, "purchasing", "create", false) && <ReturnForm receiptId={gr.id} items={gr.items} cashAccounts={cashAccounts} today={todayWib()} />}
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}
