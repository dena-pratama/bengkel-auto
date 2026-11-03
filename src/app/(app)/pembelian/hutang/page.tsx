import { Suspense } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { listApReceipts, listCashBankAccounts, listSupplierPayments } from "@/lib/purchasing";
import { cn } from "@/lib/utils";
import { PaymentForm } from "../_components/payment-form";
import { DueBadge, PurchasingNav } from "../_components/ui";
import { VoidPayment } from "../_components/void-payment";

export default function PayablesPage() {
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
  if (!can(ctx, "payables", "view", false)) return <NoAccess />;
  const [open, payments, cashAccounts] = await Promise.all([listApReceipts(), listSupplierPayments(), listCashBankAccounts()]);
  const total = open.reduce((t, r) => t + r.outstanding, 0);
  const overdue = open.filter((r) => r.days_overdue > 0).reduce((t, r) => t + r.outstanding, 0);
  const dueSoon = open.filter((r) => r.days_overdue <= 0 && r.days_overdue >= -3);
  const buckets = ["0-30", "31-60", ">60"].map((b) => ({ b, v: open.filter((r) => r.age_bucket === b).reduce((t, r) => t + r.outstanding, 0) }));

  return (
    <>
      <PurchasingNav active="payables" showPayables />
      <PageHeader title="Hutang supplier" description="Pembayaran bisa sebagian atau melunasi beberapa faktur sekaligus." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total hutang" value={formatRupiah(total)} />
        <Stat label="Lewat jatuh tempo" value={formatRupiah(overdue)} danger={overdue > 0} />
        <Stat label="Jatuh tempo ≤ 3 hari" value={`${dueSoon.length} faktur`} danger={dueSoon.length > 0} />
        <section className={cn(panel, "grid gap-1 p-4")}>
          <p className="text-xs text-muted-foreground">Umur hutang</p>
          {buckets.map(({ b, v }) => (
            <div key={b} className="flex justify-between text-sm">
              <span>{b} hari</span>
              <span className="font-semibold tabular-nums">{formatRupiah(v)}</span>
            </div>
          ))}
        </section>
      </div>

      {can(ctx, "payables", "create", false) && <PaymentForm open={open} cashAccounts={cashAccounts} today={todayWib()} />}

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Faktur belum lunas</h2>
        {open.length === 0 ? (
          <EmptyState icon={Wallet} text="Tidak ada hutang supplier." />
        ) : (
          <ul className="grid divide-y divide-border">
            {open.map((r) => (
              <li key={r.receipt_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/pembelian/penerimaan/${r.receipt_id}`} className="font-mono text-sm font-semibold hover:underline">
                    {r.gr_no}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">
                    {r.supplier_name}
                    {r.invoice_no && ` · Faktur ${r.invoice_no}`} · jatuh tempo {formatDate(r.due_date)}
                  </p>
                </div>
                <DueBadge daysOverdue={r.days_overdue} />
                <span className="w-32 text-right font-semibold tabular-nums">{formatRupiah(r.outstanding)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Riwayat pembayaran</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-3", p.status === "void" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold">
                    {p.payment_no}
                    {p.status === "void" && <span className="ml-2 rounded-sm bg-brand-red-soft px-1.5 py-0.5 font-sans text-2xs text-brand-red">Dibatalkan</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.supplier} · {formatDate(p.payment_date)} · {p.account} · {p.receipts.join(", ")}
                    {p.void_reason && ` · Alasan batal: ${p.void_reason}`}
                  </p>
                </div>
                <span className={cn("font-semibold tabular-nums", p.status === "void" && "line-through")}>{formatRupiah(p.amount)}</span>
                {p.status === "posted" && can(ctx, "payables", "void", false) && <VoidPayment id={p.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <section className={cn(panel, "grid gap-1 p-4")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", danger && "text-brand-red")}>{value}</p>
    </section>
  );
}
