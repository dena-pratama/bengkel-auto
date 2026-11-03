import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getSale, type SaleDetail } from "@/lib/cashier";
import { formatDate, formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/validation/cashier";
import { cn } from "@/lib/utils";
import { PayDialog, PrintAndShare, VoidPaymentButton, VoidSaleControl } from "../../_components/sale-actions";
import { CashierNav, PaidBadge, SaleStatusBadge, UUID } from "../../_components/ui";

export default function SaleDetailPage({ params }: PageProps<"/kasir/penjualan/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <div className="print:hidden">
        <CashierNav active="sales" />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

/** Pesan WhatsApp klik-ke-chat berisi ringkasan invoice (PRD §8.3) */
function waLink(s: SaleDetail) {
  if (!s.customer_phone || s.status !== "posted") return null;
  const text = [
    `Halo ${s.customer_name ?? ""}, berikut invoice ${s.sale_no}${s.plate_no ? ` untuk ${s.plate_no}` : ""}:`,
    ...s.lines.map((l) => `- ${l.description}${l.qty !== 1 ? ` x${formatQty(l.qty)}` : ""}: ${formatRupiah(l.line_total)}`),
    s.ppn_amount > 0 ? `PPN: ${formatRupiah(s.ppn_amount)}` : "",
    `Total: ${formatRupiah(s.total)}`,
    s.outstanding > 0 ? `Sisa tagihan: ${formatRupiah(s.outstanding)}${s.due_date ? ` (jatuh tempo ${formatDate(s.due_date)})` : ""}` : "Status: LUNAS. Terima kasih.",
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/62${s.customer_phone.replace(/^0/, "")}?text=${encodeURIComponent(text)}`;
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "sales", "view", false) && !can(ctx, "receivables", "view", false)) return <NoAccess />;
  const s = await getSale(id);
  if (!s) notFound();
  const canPay = (can(ctx, "sales", "create", false) || can(ctx, "receivables", "create", false)) && s.status === "posted" && s.outstanding > 0;
  const canVoid = can(ctx, "transaction_void", "create", false) || can(ctx, "transaction_void", "approve", false);
  const activePayments = s.payments.filter((p) => p.status === "posted");
  const dpp = s.total - s.ppn_amount;

  return (
    <>
      <PageHeader
        title={s.sale_no ?? "Draft penjualan"}
        description={[s.source === "work_order" ? `WO ${s.wo_no ?? ""}` : "Penjualan part", s.plate_no, s.customer_name ?? "Umum", formatDate(s.sale_date)].filter(Boolean).join(" · ")}
        back={{ href: "/kasir/penjualan", label: "Penjualan" }}
        actions={<PrintAndShare waLink={waLink(s)} />}
      />

      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <SaleStatusBadge status={s.status} />
          {s.status === "posted" && <PaidBadge total={s.total} outstanding={s.outstanding} overdue={s.days_overdue} />}
          {s.due_date && s.status === "posted" && <span className="text-muted-foreground">Jatuh tempo {formatDate(s.due_date)}</span>}
          {s.work_order_id && (
            <Link href={`/servis/${s.work_order_id}`} className="font-medium text-brand-blue-fg hover:underline print:hidden">
              Buka work order →
            </Link>
          )}
        </div>
        {s.void_reason && <p className="text-sm text-brand-red">Alasan batal: {s.void_reason}</p>}
        {canPay && (
          <div className="print:hidden">
            <PayDialog saleId={s.id} saleNo={s.sale_no ?? ""} outstanding={s.outstanding} />
          </div>
        )}
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Rincian</h2>
        <ul className="grid divide-y divide-border">
          {s.lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{l.description}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatQty(l.qty)} × {formatRupiah(l.unit_price)}
                  {l.discount_amount > 0 && ` · diskon ${formatRupiah(l.discount_amount)}`}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{formatRupiah(l.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto grid min-w-64 grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 border-t border-border pt-3 text-sm tabular-nums">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{formatRupiah(s.subtotal)}</dd>
          {s.discount_amount > 0 && (
            <>
              <dt className="text-muted-foreground">Diskon</dt>
              <dd className="text-right">-{formatRupiah(s.discount_amount)}</dd>
            </>
          )}
          {s.ppn_amount > 0 && (
            <>
              <dt className="text-muted-foreground">{s.ppn_included ? "DPP + lainnya (harga sudah termasuk PPN)" : "Dasar pengenaan"}</dt>
              <dd className="text-right">{formatRupiah(dpp)}</dd>
              <dt className="text-muted-foreground">PPN</dt>
              <dd className="text-right">{formatRupiah(s.ppn_amount)}</dd>
            </>
          )}
          <dt className="font-medium">Total</dt>
          <dd className="text-right text-xl font-bold">{formatRupiah(s.total)}</dd>
          <dt className="text-muted-foreground">Dibayar</dt>
          <dd className="text-right">{formatRupiah(s.paid)}</dd>
          {s.status === "posted" && s.outstanding > 0 && (
            <>
              <dt className="font-medium text-brand-red">Sisa tagihan</dt>
              <dd className="text-right font-semibold text-brand-red">{formatRupiah(s.outstanding)}</dd>
            </>
          )}
        </dl>
        {s.notes && <p className="text-sm text-muted-foreground">Catatan: {s.notes}</p>}
      </section>

      {s.payments.length > 0 && (
        <section className={cn(panel, "grid gap-2")}>
          <h2 className="text-lg font-semibold">Pembayaran</h2>
          <ul className="grid divide-y divide-border">
            {s.payments.map((p) => (
              <li key={p.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5", p.status === "void" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", p.status === "void" && "line-through")}>
                    {METHOD_LABEL[p.method]}
                    {p.account && <span className="font-normal text-muted-foreground"> · {p.account}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(p.created_at)}
                    {p.reference && ` · ${p.reference}`}
                    {p.void_reason && ` · batal: ${p.void_reason}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatRupiah(p.amount)}</span>
                {p.status === "posted" && p.method !== "deposit" && canVoid && (
                  <span className="print:hidden">
                    <VoidPaymentButton id={p.id} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.status !== "void" && canVoid && activePayments.length === 0 && (
        <section className="print:hidden">
          <VoidSaleControl id={s.id} posted={s.status === "posted"} needsPin={!can(ctx, "transaction_void", "approve", false)} />
        </section>
      )}
      {s.status === "posted" && canVoid && activePayments.length > 0 && (
        <p className="text-xs text-muted-foreground print:hidden">Untuk membatalkan invoice, batalkan dulu pembayarannya (hanya selama shift pembayaran masih terbuka).</p>
      )}
    </>
  );
}
