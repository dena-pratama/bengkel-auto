import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, PauseCircle } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getSale, getMyOpenShift, listBillableWorkOrders, listExpenseAccounts, listSales } from "@/lib/cashier";
import { listCustomers } from "@/lib/customers";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { listCatalog } from "@/lib/service";
import { cn } from "@/lib/utils";
import { CashierNav, PaidBadge } from "./_components/ui";
import { InvoiceDialog, SaleDialog, type Draft } from "./_components/sale-dialog";
import { CashOutDialog, CloseShiftDialog, OpenShiftDialog } from "./_components/shift-dialogs";

export default function CashierPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CashierNav active="cashier" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "sales", "view", false)) return <NoAccess />;
  const canSell = can(ctx, "sales", "create", false);
  const canShift = can(ctx, "cash_shift", "create", false);
  const [shift, billable, sales, customers, catalog, accounts] = await Promise.all([
    canShift ? getMyOpenShift(ctx.employee.id) : Promise.resolve(null),
    listBillableWorkOrders(),
    listSales(),
    canSell ? listCustomers() : Promise.resolve([]),
    canSell ? listCatalog() : Promise.resolve([]),
    canShift ? listExpenseAccounts() : Promise.resolve([]),
  ]);
  const drafts = sales.filter((s) => s.status === "draft");
  const draftDetails = await Promise.all(drafts.map((d) => getSale(d.id)));
  const customerOptions = customers.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  const ready = billable.filter((w) => w.status === "ready" && !w.invoice_id);
  const unpaid = billable.filter((w) => w.invoice_id && w.outstanding > 0);
  const open = billable.filter((w) => w.status !== "ready" && !w.invoice_id && w.deposit > 0);
  const recent = sales.filter((s) => s.status === "posted").slice(0, 8);

  return (
    <>
      <PageHeader
        title="Kasir"
        description="Penjualan part langsung dan tagihan work order, semua uang masuk tercatat di shift."
        actions={canSell && <SaleDialog catalog={catalog} customers={customerOptions} shiftOpen={Boolean(shift)} />}
      />

      <section className={cn(panel, "grid gap-3")}>
        {shift ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Shift {shift.shift_no} <span className="rounded-sm bg-brand-blue-soft px-2 py-0.5 text-xs font-medium text-brand-blue-fg">Terbuka</span>
                </h2>
                <p className="text-sm text-muted-foreground">Dibuka {formatDateTime(shift.opened_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CashOutDialog accounts={accounts} />
                <CloseShiftDialog expected={shift.expected_now ?? 0} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {[
                ["Modal awal", shift.opening_cash],
                ["Tunai masuk", shift.cash_in],
                ["Kas keluar", shift.cash_out],
                ["Kas seharusnya", shift.expected_now ?? 0],
                ["Non-tunai", shift.transfer_in + shift.qris_in + shift.card_in],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-sm bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">{label as string}</dt>
                  <dd className="text-base font-semibold tabular-nums">{formatRupiah(value as number)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Belum ada shift terbuka</h2>
              <p className="text-sm text-muted-foreground">Transaksi tidak bisa menerima uang tanpa shift terbuka.</p>
            </div>
            {canShift ? <OpenShiftDialog /> : <p className="text-sm text-muted-foreground">Hanya Kasir yang membuka shift.</p>}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
          <h2 className="text-lg font-semibold">Siap ditagih</h2>
          {ready.length === 0 && unpaid.length === 0 && open.length === 0 ? (
            <EmptyState icon={ClipboardCheck} text="Tidak ada work order yang menunggu ditagih." />
          ) : (
            <ul className="grid divide-y divide-border">
              {ready.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <Link href={`/servis/${w.id}`} className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">
                      {w.plate_no} <span className="font-normal text-muted-foreground">· {w.wo_no}</span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{[w.customer_name, w.services].filter(Boolean).join(" · ")}</p>
                  </Link>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatRupiah(w.total)}</p>
                    {w.deposit > 0 && <p className="text-xs text-muted-foreground">DP {formatRupiah(w.deposit)}</p>}
                  </div>
                  {canSell && <InvoiceDialog woId={w.id} woNo={w.wo_no} deposit={w.deposit} />}
                </li>
              ))}
              {unpaid.map((w) => (
                <li key={w.id}>
                  <Link href={`/kasir/penjualan/${w.invoice_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold">
                        {w.plate_no} <span className="font-normal text-muted-foreground">· {w.invoice_no}</span>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">Invoice belum lunas</p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatRupiah(w.outstanding)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              {open.map((w) => (
                <li key={w.id}>
                  <Link href={`/servis/${w.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold">
                        {w.plate_no} <span className="font-normal text-muted-foreground">· {w.wo_no}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">Masih dikerjakan, DP {formatRupiah(w.deposit)} diterima</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-5">
          <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
            <h2 className="text-lg font-semibold">Transaksi ditahan</h2>
            {drafts.length === 0 ? (
              <EmptyState icon={PauseCircle} text="Tidak ada transaksi yang ditahan." />
            ) : (
              <ul className="grid divide-y divide-border">
                {drafts.map((d, i) => {
                  const detail = draftDetails[i];
                  const draft: Draft | undefined = detail
                    ? {
                        id: d.id,
                        customer_id: d.customer_id ?? "",
                        discount_amount: d.discount_amount ? String(d.discount_amount) : "",
                        notes: d.notes ?? "",
                        lines: detail.lines.filter((l) => l.item_id).map((l) => ({ item_id: l.item_id!, qty: String(l.qty), discount_amount: l.discount_amount ? String(l.discount_amount) : "" })),
                      }
                    : undefined;
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{d.customer_name ?? "Umum"}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.line_count} barang · {formatDateTime(d.created_at)}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{formatRupiah(d.total)}</span>
                      {canSell && draft && <SaleDialog catalog={catalog} customers={customerOptions} shiftOpen={Boolean(shift)} draft={draft} label="Lanjutkan" variant="outline" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
            <h2 className="text-lg font-semibold">Transaksi terakhir</h2>
            <ul className="grid divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link href={`/kasir/penjualan/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold">{s.sale_no}</p>
                      <p className="truncate text-xs text-muted-foreground">{[s.plate_no, s.customer_name ?? "Umum"].filter(Boolean).join(" · ")}</p>
                    </div>
                    <PaidBadge total={s.total} outstanding={s.outstanding} overdue={s.days_overdue} />
                    <span className="w-28 text-right font-semibold tabular-nums">{formatRupiah(s.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
