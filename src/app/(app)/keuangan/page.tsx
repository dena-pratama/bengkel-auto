import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Landmark,
  Plus,
  Repeat,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { AttachmentButton } from "@/components/attachment-panel";
import { ListFilter } from "@/components/list-filter";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { listAccounts, listCashBankBalances, listCashTransactions, listRecurringExpenses } from "@/lib/finance";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { TXN_KINDS, TXN_KIND_LABEL } from "@/lib/validation/finance";
import { cn } from "@/lib/utils";
import { FinanceNav } from "./_components/ui";
import {
  CashBankDialog,
  CashTxnDialog,
  ConfirmRecurringDialog,
  RecurringDialog,
  ToggleRecurringButton,
  VoidTxnButton,
} from "./_components/dialogs";

export default function FinancePage({ searchParams }: PageProps<"/keuangan">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  const canExpenses = can(ctx, "expenses", "view", false);
  const canReports = can(ctx, "finance_reports", "view", false);
  const canLedger = canReports || can(ctx, "journal", "view", false);
  if (!canExpenses && !canLedger) return <NoAccess />;
  const today = todayWib();
  const canCreate = can(ctx, "expenses", "create", false);
  const canOwnerTxn = can(ctx, "journal", "create", false);
  const sp = await searchParams;
  const range = readRange(sp, today, "30-hari");
  const kind = readOption(sp, "jenis", TXN_KINDS);
  const balancesAll = await listCashBankBalances(today);
  const account = readOption(sp, "akun-kas", balancesAll.map((b) => b.cash_bank_account_id));
  const [balances, txns, recurring, accounts] = await Promise.all([
    Promise.resolve(balancesAll),
    listCashTransactions({ from: range.from, to: range.to, kind, account }),
    canExpenses ? listRecurringExpenses() : Promise.resolve([]),
    listAccounts(),
  ]);
  const total = balances.filter((b) => b.is_active).reduce((t, b) => t + b.balance, 0);
  const dueRecurring = recurring.filter((r) => r.is_active && !r.confirmed_this_month);
  const dueRecurringTotal = dueRecurring.reduce((s, r) => s + r.amount, 0);
  const totalMonthlyRecurring = recurring.filter((r) => r.is_active).reduce((s, r) => s + r.amount, 0);

  // Summary statistics for current filtered view
  const validTxns = txns.filter((t) => t.status !== "void");
  const totalIncome = validTxns
    .filter((t) => t.kind === "income" || t.kind === "capital")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = validTxns
    .filter((t) => t.kind === "expense" || t.kind === "drawing")
    .reduce((s, t) => s + t.amount, 0);
  const netCashflow = totalIncome - totalExpense;

  return (
    <>
      <FinanceNav active="cash" showReports={canReports} showLedger={canLedger} />
      <PageHeader
        title="Kas & bank"
        description={`Total saldo ${formatRupiah(total)}${dueRecurring.length ? ` · ${dueRecurring.length} biaya rutin menunggu konfirmasi` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <>
                <CashTxnDialog kind="expense" variant="default" cashAccounts={balances} accounts={accounts} today={today} />
                <CashTxnDialog kind="income" cashAccounts={balances} accounts={accounts} today={today} />
                <CashTxnDialog kind="transfer" cashAccounts={balances} accounts={accounts} today={today} />
              </>
            )}
            {canOwnerTxn && (
              <>
                <CashTxnDialog kind="capital" cashAccounts={balances} accounts={accounts} today={today} />
                <CashTxnDialog kind="drawing" cashAccounts={balances} accounts={accounts} today={today} />
              </>
            )}
          </div>
        }
      />

      {/* Accounts Grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {balances.map((b) => (
          <div
            key={b.cash_bank_account_id}
            className={cn(
              panel,
              "flex flex-col justify-between gap-3 p-4.5 transition-shadow hover:shadow-md",
              !b.is_active && "opacity-60"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
                    b.kind === "cash"
                      ? "bg-brand-sand-soft text-brand-sand"
                      : "bg-brand-blue-soft text-brand-blue-fg"
                  )}
                >
                  {b.kind === "cash" ? (
                    <Wallet className="size-5" strokeWidth={1.75} />
                  ) : (
                    <Landmark className="size-5" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.kind === "cash"
                      ? "Kas operasional"
                      : [b.bank_name, b.account_number].filter(Boolean).join(" · ") || "Rekening operasional"}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  b.is_active
                    ? "bg-brand-green-soft text-brand-green"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {b.is_active ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo saat ini</p>
              <p
                className={cn(
                  "text-2xl font-bold tracking-tight tabular-nums",
                  b.balance < 0 && "text-brand-red"
                )}
              >
                {formatRupiah(b.balance)}
              </p>
            </div>
          </div>
        ))}
        {canOwnerTxn && (
          <CashBankDialog
            trigger={
              <button
                type="button"
                className="flex h-full min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-blue/40 bg-brand-blue-soft/20 p-4 text-center transition-all hover:border-brand-blue hover:bg-brand-blue-soft/40"
              >
                <div className="flex size-9 items-center justify-center rounded-[10px] bg-brand-blue-soft text-brand-blue-fg">
                  <Plus className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Akun kas/bank</p>
                  <p className="text-xs text-muted-foreground">Tambah rekening atau dompet</p>
                </div>
              </button>
            }
          />
        )}
      </section>

      {/* 4 Summary Stat Cards matching Figma */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
            <ArrowDownToLine className="size-5 text-brand-green" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Uang masuk</p>
            <p className="text-lg font-semibold leading-tight tabular-nums text-brand-green sm:text-xl">
              {formatRupiah(totalIncome)}
            </p>
            <p className="text-[11px] text-muted-foreground">penjualan & pendapatan</p>
          </div>
        </div>

        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
            <ArrowUpFromLine className="size-5 text-brand-red" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Uang keluar</p>
            <p className="text-lg font-semibold leading-tight tabular-nums text-brand-red sm:text-xl">
              {formatRupiah(totalExpense)}
            </p>
            <p className="text-[11px] text-muted-foreground">pembelian, biaya, gaji</p>
          </div>
        </div>

        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
            <TrendingUp className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Arus kas bersih</p>
            <p
              className={cn(
                "text-lg font-semibold leading-tight tabular-nums sm:text-xl",
                netCashflow >= 0 ? "text-brand-blue-fg" : "text-brand-red"
              )}
            >
              {netCashflow >= 0 ? "+" : ""}
              {formatRupiah(netCashflow)}
            </p>
            <p className="text-[11px] text-muted-foreground">selisih periode terpilih</p>
          </div>
        </div>

        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
            <Repeat className="size-5 text-brand-sand" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Biaya rutin menunggu</p>
            <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">
              {dueRecurring.length} tagihan
            </p>
            <p className="text-[11px] text-muted-foreground">
              {dueRecurring.length > 0 ? `${formatRupiah(dueRecurringTotal)} · belum konfirmasi` : "Semua beres"}
            </p>
          </div>
        </div>
      </section>

      {/* Filter Section */}
      <ListFilter
        today={today}
        range={range}
        defaultRange="30-hari"
        dateLabel="Tanggal transaksi"
        selects={[
          {
            name: "jenis",
            label: "Jenis transaksi",
            value: kind,
            options: TXN_KINDS.map((v) => ({ value: v, label: TXN_KIND_LABEL[v] })),
            allLabel: "Semua jenis",
          },
          {
            name: "akun-kas",
            label: "Kas atau bank",
            value: account,
            options: balancesAll.map((b) => ({ value: b.cash_bank_account_id, label: b.name })),
            allLabel: "Semua akun",
          },
        ]}
      />

      {/* Two Column Content Row */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Left: Transaksi Kas */}
        <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-lg font-semibold">Transaksi kas</h2>
              <p className="text-xs text-muted-foreground">
                {describeRange(range, formatDate)} · {txns.length} transaksi
              </p>
            </div>
            {canReports && (
              <Link
                href={`/api/v1/keuangan/export?jenis=laba-rugi&dari=${range.from ?? ""}&sampai=${range.to ?? ""}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Download className="size-3.5" />
                Ekspor
              </Link>
            )}
          </div>

          {txns.length === 0 ? (
            <EmptyState
              icon={Landmark}
              text="Belum ada transaksi kas. Penjualan dan pembelian tercatat lewat modulnya masing-masing."
            />
          ) : (
            <div className="overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2.5 pt-1">Transaksi</th>
                    <th className="pb-2.5 pt-1">Akun</th>
                    <th className="pb-2.5 pt-1">Tanggal</th>
                    <th className="pb-2.5 pt-1 text-right">Jumlah</th>
                    <th className="pb-2.5 pt-1 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {txns.map((t) => {
                    const incoming = t.kind === "income" || t.kind === "capital";
                    const isVoid = t.status === "void";
                    return (
                      <tr
                        key={t.id}
                        className={cn("transition-colors hover:bg-muted/40", isVoid && "opacity-60")}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tight",
                                incoming
                                  ? "bg-brand-green-soft text-brand-green"
                                  : t.kind === "transfer"
                                    ? "bg-brand-blue-soft text-brand-blue-fg"
                                    : "bg-brand-sand-soft text-brand-sand"
                              )}
                            >
                              {TXN_KIND_LABEL[t.kind]}
                            </span>
                            <span className={cn("font-medium", isVoid && "line-through")}>
                              {t.description}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {t.txn_no}
                            {t.void_reason ? ` · batal: ${t.void_reason}` : ""}
                          </p>
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {t.kind === "transfer"
                            ? `${t.cash_bank_name} → ${t.to_cash_bank_name}`
                            : `${t.cash_bank_name}${t.account_name ? ` · ${t.account_name}` : ""}`}
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {formatDate(t.txn_date)}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              incoming ? "text-brand-green" : t.kind === "transfer" ? "text-foreground" : "text-brand-red"
                            )}
                          >
                            {incoming ? "+" : t.kind === "transfer" ? "" : "-"}
                            {formatRupiah(t.amount)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <AttachmentButton
                              entityType="cash_transaction"
                              entityId={t.id}
                              title={`Bukti ${t.txn_no}`}
                              canEdit={can(ctx, "expenses", "create", false)}
                            />
                            {t.status === "posted" &&
                              (can(ctx, "expenses", "void", false) || can(ctx, "journal", "void", false)) && (
                                <VoidTxnButton id={t.id} />
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: Biaya Rutin Bulanan */}
        {canExpenses && (
          <section className={cn(panel, "flex flex-col justify-between gap-4 p-4 sm:p-5")}>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="text-lg font-semibold">Biaya rutin bulanan</h2>
                  <p className="text-xs text-muted-foreground">Template pengeluaran berkala per bulan</p>
                </div>
                {canCreate && <RecurringDialog accounts={accounts} cashAccounts={balances} />}
              </div>

              {recurring.length === 0 ? (
                <EmptyState
                  icon={Repeat}
                  text="Belum ada template. Tambahkan sewa, listrik, atau internet agar tinggal dikonfirmasi tiap bulan."
                />
              ) : (
                <ul className="grid divide-y divide-border">
                  {recurring.map((r) => (
                    <li key={r.id} className={cn("grid gap-1.5 py-3", !r.is_active && "opacity-60")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{r.name}</p>
                        <span className="font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.account_name} · dari {r.cash_bank_name} · tiap tgl {r.day_of_month}
                        {r.last_confirmed_on && ` · terakhir ${formatDate(r.last_confirmed_on)}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {r.is_active && !r.confirmed_this_month && canCreate && (
                          <ConfirmRecurringDialog item={r} today={today} />
                        )}
                        {r.is_active && r.confirmed_this_month && (
                          <span className="rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green">
                            Sudah dikonfirmasi bulan ini
                          </span>
                        )}
                        {can(ctx, "expenses", "update", false) && (
                          <>
                            <RecurringDialog item={r} accounts={accounts} cashAccounts={balances} />
                            <ToggleRecurringButton id={r.id} active={r.is_active} />
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {recurring.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3 text-xs">
                <span className="text-muted-foreground">Total biaya rutin / bulan</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatRupiah(totalMonthlyRecurring)}
                </span>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
