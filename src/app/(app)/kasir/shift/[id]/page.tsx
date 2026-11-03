import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { PrintButton } from "../../_components/print-button";
import { can, requireUser } from "@/lib/auth";
import { getShift } from "@/lib/cashier";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/validation/cashier";
import { cn } from "@/lib/utils";
import { ApproveShiftControl } from "../../_components/sale-actions";
import { ShiftStatusBadge } from "../../_components/shift-ui";
import { CashierNav, UUID } from "../../_components/ui";

export default function ShiftDetailPage({ params }: PageProps<"/kasir/shift/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <div className="print:hidden">
        <CashierNav active="shifts" />
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
  if (!can(ctx, "cash_shift", "view", false) && !can(ctx, "cash_shift", "approve", false)) return <NoAccess />;
  const s = await getShift(id);
  if (!s) notFound();
  const expected = s.expected_cash ?? s.expected_now ?? 0;
  const canApprove = s.status === "closed" && can(ctx, "cash_shift", "approve", false) && (s.cashier_id !== ctx.employee.id || ctx.is_superuser);
  const payments = s.payments.filter((p) => p.status === "posted");
  const sum = (m: string) => payments.filter((p) => p.method === m).reduce((t, p) => t + p.amount, 0);

  return (
    <>
      <PageHeader
        title={`Shift ${s.shift_no}`}
        description={`${s.cashier_name} · dibuka ${formatDateTime(s.opened_at)}${s.closed_at ? ` · ditutup ${formatDateTime(s.closed_at)}` : ""}`}
        back={{ href: "/kasir/shift", label: "Shift kas" }}
        actions={<PrintButton />}
      />
      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center gap-3">
          <ShiftStatusBadge status={s.status} />
          {s.approved_at && <span className="text-sm text-muted-foreground">Disetujui {formatDateTime(s.approved_at)}</span>}
        </div>
        {s.close_note && <p className="text-sm">Catatan kasir: {s.close_note}</p>}
        {s.approval_note && <p className="text-sm">Catatan persetujuan: {s.approval_note}</p>}
        {canApprove && (
          <div className="print:hidden">
            <ApproveShiftControl id={s.id} variance={s.variance ?? 0} />
          </div>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className={cn(panel, "grid content-start gap-2")}>
          <h2 className="text-lg font-semibold">Rekap kas tunai</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">Modal awal</dt>
            <dd className="text-right">{formatRupiah(s.opening_cash)}</dd>
            <dt className="text-muted-foreground">Tunai masuk</dt>
            <dd className="text-right">{formatRupiah(s.cash_in)}</dd>
            <dt className="text-muted-foreground">Kas keluar</dt>
            <dd className="text-right">-{formatRupiah(s.cash_out)}</dd>
            <dt className="font-medium">Kas seharusnya</dt>
            <dd className="text-right font-semibold">{formatRupiah(expected)}</dd>
            {s.counted_cash != null && (
              <>
                <dt className="text-muted-foreground">Uang fisik</dt>
                <dd className="text-right">{formatRupiah(s.counted_cash)}</dd>
                <dt className="font-medium">Selisih</dt>
                <dd className={cn("text-right text-lg font-bold", s.variance !== 0 && "text-brand-red")}>{formatRupiah(s.variance)}</dd>
              </>
            )}
          </dl>
        </section>
        <section className={cn(panel, "grid content-start gap-2")}>
          <h2 className="text-lg font-semibold">Penerimaan non-tunai</h2>
          <p className="text-xs text-muted-foreground">Dicocokkan dengan mutasi bank / laporan EDC.</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
            {(["transfer", "qris", "card"] as const).map((m) => (
              <div key={m} className="contents">
                <dt className="text-muted-foreground">{METHOD_LABEL[m]}</dt>
                <dd className="text-right">{formatRupiah(sum(m))}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className={cn(panel, "grid gap-2")}>
        <h2 className="text-lg font-semibold">Transaksi di shift ini</h2>
        {s.payments.length === 0 && s.cashOuts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
        ) : (
          <ul className="grid divide-y divide-border text-sm">
            {s.payments.map((p) => (
              <li key={p.id} className={cn("flex flex-wrap items-center gap-x-4 py-2", p.status === "void" && "line-through opacity-60")}>
                <span className="w-24 text-xs text-muted-foreground">{formatDateTime(p.created_at).slice(-11)}</span>
                <span className="min-w-0 flex-1">
                  {p.kind === "deposit" ? "DP" : "Pembayaran"} {METHOD_LABEL[p.method]}
                  {p.sale_id && p.sales?.sale_no && (
                    <>
                      {" "}
                      <Link href={`/kasir/penjualan/${p.sale_id}`} className="font-mono text-brand-blue-fg hover:underline">
                        {p.sales.sale_no}
                      </Link>
                    </>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{formatRupiah(p.amount)}</span>
              </li>
            ))}
            {s.cashOuts.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 py-2">
                <span className="w-24 text-xs text-muted-foreground">{formatDateTime(o.created_at).slice(-11)}</span>
                <span className="min-w-0 flex-1">
                  Kas keluar: {o.accounts.name} · {o.note}
                </span>
                <span className="font-semibold text-brand-red tabular-nums">-{formatRupiah(o.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
