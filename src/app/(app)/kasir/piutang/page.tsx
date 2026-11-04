import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ListFilter } from "@/components/list-filter";
import { listArCustomers, listOutstandingSales } from "@/lib/cashier";
import { readOption, readRange, describeRange } from "@/lib/list-filter";
import { AGE_FILTERS, AGE_FILTER_LABEL } from "@/lib/validation/cashier";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CashierNav, PaidBadge } from "../_components/ui";

export default function ReceivablesPage({ searchParams }: PageProps<"/kasir/piutang">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CashierNav active="ar" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "receivables", "view", false) && !can(ctx, "sales", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "semua");
  const age = readOption(sp, "umur", AGE_FILTERS);
  const [customers, invoices] = await Promise.all([listArCustomers(), listOutstandingSales({ from: range.from, to: range.to, age })]);
  const total = invoices.reduce((t, i) => t + i.outstanding, 0);
  const noCustomer = invoices.filter((i) => !i.customer_id);

  return (
    <>
      <PageHeader title="Piutang" description={`${invoices.length} invoice belum lunas · total ${formatRupiah(total)}${range.from || range.to || age ? ` · ${describeRange(range, formatDate)}` : ""}`} />
      <ListFilter
        today={today}
        range={range}
        defaultRange="semua"
        dateLabel="Tanggal invoice"
        selects={[{ name: "umur", label: "Umur piutang", value: age, options: AGE_FILTERS.map((v) => ({ value: v, label: AGE_FILTER_LABEL[v] })), allLabel: "Semua umur" }]}
      />
      <p className="-mt-2 text-xs text-muted-foreground">Filter berlaku untuk daftar invoice di bawah. Rekap per pelanggan selalu menampilkan seluruh piutang.</p>
      <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
        <h2 className="text-lg font-semibold">Per pelanggan</h2>
        {customers.length === 0 ? (
          <EmptyState icon={Wallet} text="Tidak ada piutang." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Pelanggan</th>
                  <th className="py-2 text-right font-medium">Invoice</th>
                  <th className="py-2 text-right font-medium">0-30 hari</th>
                  <th className="py-2 text-right font-medium">31-60 hari</th>
                  <th className="py-2 text-right font-medium">&gt; 60 hari</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {customers.map((c) => (
                  <tr key={c.customer_id}>
                    <td className="py-2.5 font-medium">
                      <Link href={`/pelanggan/${c.customer_id}`} className="hover:underline">
                        {c.customer_name}
                      </Link>
                    </td>
                    <td className="py-2.5 text-right">{c.invoices}</td>
                    <td className="py-2.5 text-right">{formatRupiah(c.bucket_0_30)}</td>
                    <td className="py-2.5 text-right">{formatRupiah(c.bucket_31_60)}</td>
                    <td className={cn("py-2.5 text-right", (c.bucket_60_plus ?? 0) > 0 && "font-semibold text-brand-red")}>{formatRupiah(c.bucket_60_plus)}</td>
                    <td className="py-2.5 text-right font-semibold">{formatRupiah(c.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
        <h2 className="text-lg font-semibold">Invoice belum lunas</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua invoice sudah lunas.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link href={`/kasir/penjualan/${i.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">
                      {i.sale_no} <span className="font-normal text-muted-foreground">· {i.customer_name ?? "Umum"}</span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[i.plate_no, formatDate(i.sale_date)].filter(Boolean).join(" · ")}
                      {i.due_date && ` · jatuh tempo ${formatDate(i.due_date)}`}
                    </p>
                  </div>
                  <PaidBadge total={i.total} outstanding={i.outstanding} overdue={i.days_overdue} />
                  <span className="w-32 text-right font-semibold tabular-nums">{formatRupiah(i.outstanding)}</span>
                  <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {noCustomer.length > 0 && <p className="text-xs text-muted-foreground">{noCustomer.length} invoice atas nama Umum belum lunas (tidak masuk rekap per pelanggan).</p>}
      </section>
    </>
  );
}
