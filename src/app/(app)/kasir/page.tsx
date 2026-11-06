import { Suspense } from "react";
import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  PauseCircle,
  QrCode,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
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

      {/* Card/Shift */}
      <section className={cn(panel, "grid gap-5 p-5")}>
        {shift ? (
          <>
            {/* Header shift */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-[10px] bg-brand-green-soft">
                  <Wallet className="size-5 text-brand-green" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] font-semibold leading-6">{shift.shift_no}</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green">
                      <span className="size-1.5 rounded-full bg-brand-green" />
                      Terbuka
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">Dibuka {formatDateTime(shift.opened_at)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <CashOutDialog accounts={accounts} />
                <CloseShiftDialog expected={shift.expected_now ?? 0} />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {/* Kas seharusnya - highlight biru */}
              <div className="order-first col-span-2 rounded-[10px] bg-brand-blue-soft p-4 sm:order-4 sm:col-span-1">
                <p className="text-xs font-medium text-brand-blue-fg">Kas seharusnya</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-brand-blue-fg">{formatRupiah(shift.expected_now ?? 0)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Modal + tunai - keluar</p>
              </div>
              {/* Modal awal */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-1">
                <p className="text-xs font-medium text-muted-foreground">Modal awal</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(shift.opening_cash)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Setoran awal</p>
              </div>
              {/* Tunai masuk */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-2">
                <p className="text-xs font-medium text-muted-foreground">Tunai masuk</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(shift.cash_in)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Dari penjualan</p>
              </div>
              {/* Kas keluar */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-3">
                <p className="text-xs font-medium text-muted-foreground">Kas keluar</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(shift.cash_out)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Pengeluaran</p>
              </div>
              {/* Non-tunai */}
              <div className="rounded-[10px] bg-muted/50 p-4 sm:order-5">
                <p className="text-xs font-medium text-muted-foreground">Non-tunai</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(shift.transfer_in + shift.qris_in + shift.card_in)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">QRIS & transfer</p>
              </div>
            </div>

            {/* Methods row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3">
              <span className="text-xs font-medium text-muted-foreground">Pembayaran hari ini</span>
              <span className="flex items-center gap-1.5 text-xs">
                <Banknote className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Tunai</span>
                <span className="font-semibold tabular-nums">{formatRupiah(shift.cash_in)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <QrCode className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">QRIS</span>
                <span className="font-semibold tabular-nums">{formatRupiah(shift.qris_in)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <Receipt className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Transfer</span>
                <span className="font-semibold tabular-nums">{formatRupiah(shift.transfer_in)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <CreditCard className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Kartu</span>
                <span className="font-semibold tabular-nums">{formatRupiah(shift.card_in)}</span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-[10px] bg-muted">
                <Wallet className="size-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold leading-6">Belum ada shift terbuka</h2>
                <p className="text-[13px] text-muted-foreground">Transaksi tidak bisa menerima uang tanpa shift terbuka.</p>
              </div>
            </div>
            {canShift ? <OpenShiftDialog /> : <p className="text-sm text-muted-foreground">Hanya Kasir yang membuka shift.</p>}
          </div>
        )}
      </section>

      {/* Row/Content: LeftColumn + RightColumn */}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="grid content-start gap-5">
          {/* Card/Siap ditagih */}
          <section className={cn(panel, "overflow-hidden p-0")}>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-muted-foreground" />
                  <h2 className="text-[15px] font-semibold">Siap ditagih</h2>
                  {(ready.length + unpaid.length) > 0 && (
                    <span className="rounded-full bg-brand-blue-soft px-2 py-0.5 text-xs font-medium text-brand-blue-fg">
                      {ready.length + unpaid.length}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Work order selesai yang menunggu pembayaran</p>
              </div>
              <Link href="/servis" className="text-[13px] font-semibold text-brand-blue-fg hover:underline">
                Lihat semua
              </Link>
            </div>
            {ready.length === 0 && unpaid.length === 0 && open.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState icon={ClipboardCheck} text="Tidak ada work order yang menunggu ditagih." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">WORK ORDER</th>
                      <th className="px-3 py-2.5 font-medium">PELANGGAN</th>
                      <th className="px-3 py-2.5 text-right font-medium">ITEM</th>
                      <th className="px-3 py-2.5 text-right font-medium">TOTAL</th>
                      {canSell && <th className="px-5 py-2.5 text-right font-medium" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ready.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link href={`/servis/${w.id}`} className="hover:underline">
                            <p className="font-mono text-sm font-semibold">{w.wo_no}</p>
                            <p className="text-xs text-muted-foreground">{w.plate_no}</p>
                          </Link>
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-sm text-muted-foreground">
                          {w.customer_name ?? "Umum"}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-muted-foreground">
                          {w.services ? w.services.split(",").length : "-"}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {formatRupiah(w.total)}
                          {w.deposit > 0 && (
                            <p className="text-xs font-normal text-muted-foreground">DP {formatRupiah(w.deposit)}</p>
                          )}
                        </td>
                        {canSell && (
                          <td className="px-5 py-3 text-right">
                            <InvoiceDialog woId={w.id} woNo={w.wo_no} deposit={w.deposit} />
                          </td>
                        )}
                      </tr>
                    ))}
                    {unpaid.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3" colSpan={2}>
                          <Link href={`/kasir/penjualan/${w.invoice_id}`} className="hover:underline">
                            <p className="font-mono text-sm font-semibold">{w.invoice_no}</p>
                            <p className="text-xs text-muted-foreground">{w.plate_no}</p>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground" />
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {formatRupiah(w.outstanding)}
                          <p className="text-xs font-normal text-muted-foreground">Belum lunas</p>
                        </td>
                        {canSell && (
                          <td className="px-5 py-3 text-right">
                            <Link href={`/kasir/penjualan/${w.invoice_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue-fg hover:underline">
                              Bayar <ChevronRight className="size-3.5" />
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                    {open.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3" colSpan={2}>
                          <Link href={`/servis/${w.id}`} className="hover:underline">
                            <p className="font-mono text-sm font-semibold">{w.wo_no}</p>
                            <p className="text-xs text-muted-foreground">{w.plate_no} - Masih dikerjakan</p>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground" />
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {formatRupiah(w.deposit)}
                          <p className="text-xs font-normal text-muted-foreground">DP diterima</p>
                        </td>
                        {canSell && <td className="px-5 py-3" />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Card/Transaksi terakhir */}
          <section className={cn(panel, "overflow-hidden p-0")}>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="size-4 text-muted-foreground" />
                  <h2 className="text-[15px] font-semibold">Transaksi terakhir</h2>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {recent.length > 0 ? `${recent.length} transaksi terbaru hari ini` : "Belum ada transaksi hari ini"}
                </p>
              </div>
              <Link href="/kasir/penjualan" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue-fg hover:underline">
                Penjualan & invoice <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState icon={Receipt} text="Belum ada transaksi." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">INVOICE</th>
                      <th className="px-3 py-2.5 font-medium">PELANGGAN</th>
                      <th className="px-3 py-2.5 font-medium">METODE</th>
                      <th className="px-3 py-2.5 font-medium">STATUS</th>
                      <th className="px-5 py-2.5 text-right font-medium">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recent.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link href={`/kasir/penjualan/${s.id}`} className="hover:underline">
                            <p className="font-mono text-sm font-semibold">{s.sale_no}</p>
                            {s.wo_no && <p className="text-xs text-muted-foreground">{s.wo_no}</p>}
                          </Link>
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-3 text-sm text-muted-foreground">
                          {[s.plate_no, s.customer_name ?? "Umum"].filter(Boolean).join(" · ")}
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          {s.source === "work_order" ? "WO" : "Langsung"}
                        </td>
                        <td className="px-3 py-3">
                          <PaidBadge total={s.total} outstanding={s.outstanding} overdue={s.days_overdue} />
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums">
                          {formatRupiah(s.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="grid content-start gap-5">
          {/* Card/Transaksi ditahan */}
          <section className={cn(panel, "grid gap-4 p-5")}>
            <div>
              <div className="flex items-center gap-2">
                <PauseCircle className="size-4 text-muted-foreground" />
                <h2 className="text-[15px] font-semibold">Transaksi ditahan</h2>
                {drafts.length > 0 && (
                  <span className="rounded-full bg-brand-sand-soft px-2 py-0.5 text-xs font-medium text-foreground">
                    {drafts.length}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Lanjutkan sebelum tutup shift</p>
            </div>
            {drafts.length === 0 ? (
              <EmptyState icon={PauseCircle} text="Tidak ada transaksi yang ditahan." />
            ) : (
              <ul className="grid gap-2">
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
                    <li key={d.id} className="flex items-center gap-3 rounded-[10px] bg-muted/40 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-sand-soft">
                        <PauseCircle className="size-4 text-brand-sand" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{d.customer_name ?? "Umum"}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.line_count} item · {formatDateTime(d.created_at)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold tabular-nums">{formatRupiah(d.total)}</p>
                      </div>
                      {canSell && draft && (
                        <SaleDialog catalog={catalog} customers={customerOptions} shiftOpen={Boolean(shift)} draft={draft} label="Lanjutkan" variant="outline" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Card/Aksi cepat */}
          <section className={cn(panel, "grid gap-3 p-5")}>
            <h2 className="text-[15px] font-semibold">Aksi cepat</h2>
            <ul className="grid gap-1">
              {[
                {
                  icon: ShoppingCart,
                  label: "Jual part langsung",
                  sub: "Tanpa work order",
                  href: null,
                },
                {
                  icon: Receipt,
                  label: "Tagih work order",
                  sub: `${ready.length} WO siap ditagih`,
                  href: "/servis",
                },
                {
                  icon: Wallet,
                  label: "Terima pembayaran piutang",
                  sub: `${unpaid.length} invoice belum lunas`,
                  href: "/kasir/piutang",
                },
                {
                  icon: RotateCcw,
                  label: "Retur penjualan",
                  sub: "Barang kembali",
                  href: "/kasir/retur",
                },
              ].map(({ icon: Icon, label, sub, href }) =>
                href ? (
                  <li key={label}>
                    <Link
                      href={href}
                      className="flex items-center gap-3 rounded-[10px] px-3 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft">
                        <Icon className="size-4 text-brand-blue-fg" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ) : (
                  <li key={label}>
                    <div className="flex items-center gap-3 rounded-[10px] px-3 py-3.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft">
                        <Icon className="size-4 text-brand-blue-fg" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                      {canSell && (
                        <SaleDialog catalog={catalog} customers={customerOptions} shiftOpen={Boolean(shift)} />
                      )}
                    </div>
                  </li>
                )
              )}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
