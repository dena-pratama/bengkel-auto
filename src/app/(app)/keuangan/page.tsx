import { Suspense } from "react";
import { Landmark, Repeat } from "lucide-react";
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
import { CashBankDialog, CashTxnDialog, ConfirmRecurringDialog, RecurringDialog, ToggleRecurringButton, VoidTxnButton } from "./_components/dialogs";

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

  return (
    <>
      <FinanceNav active="cash" showReports={canReports} showLedger={canLedger} />
      <PageHeader
        title="Kas & bank"
        description={`Total saldo ${formatRupiah(total)}${dueRecurring.length ? ` · ${dueRecurring.length} biaya rutin menunggu konfirmasi` : ""}`}
        actions={
          <>
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
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {balances.map((b) => (
          <div key={b.cash_bank_account_id} className={cn(panel, "grid gap-1", !b.is_active && "opacity-60")}>
            <p className="text-sm text-muted-foreground">{b.kind === "cash" ? "Kas" : "Bank"}</p>
            <p className="text-lg font-semibold">{b.name}</p>
            <p className={cn("text-2xl font-bold tabular-nums", b.balance < 0 && "text-brand-red")}>{formatRupiah(b.balance)}</p>
            {b.account_number && <p className="text-xs text-muted-foreground">{[b.bank_name, b.account_number].filter(Boolean).join(" · ")}</p>}
          </div>
        ))}
        {canOwnerTxn && (
          <div className="flex items-center justify-center rounded-[28px] border-2 border-dashed border-brand-blue/50 bg-brand-blue-soft/40 p-5">
            <CashBankDialog />
          </div>
        )}
      </section>

      <ListFilter
        today={today}
        range={range}
        defaultRange="30-hari"
        dateLabel="Tanggal transaksi"
        selects={[
          { name: "jenis", label: "Jenis transaksi", value: kind, options: TXN_KINDS.map((v) => ({ value: v, label: TXN_KIND_LABEL[v] })), allLabel: "Semua jenis" },
          { name: "akun-kas", label: "Kas atau bank", value: account, options: balancesAll.map((b) => ({ value: b.cash_bank_account_id, label: b.name })), allLabel: "Semua akun" },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className={cn(panel, "grid content-start gap-2")}>
          <h2 className="text-lg font-semibold">
            Transaksi kas <span className="text-sm font-normal text-muted-foreground">· {describeRange(range, formatDate)} · {txns.length} transaksi</span>
          </h2>
          {txns.length === 0 ? (
            <EmptyState icon={Landmark} text="Belum ada transaksi kas. Penjualan dan pembelian tercatat lewat modulnya masing-masing." />
          ) : (
            <ul className="grid divide-y divide-border">
              {txns.map((t) => {
                const incoming = t.kind === "income" || t.kind === "capital";
                return (
                  <li key={t.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-3", t.status === "void" && "opacity-60")}>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", t.status === "void" && "line-through")}>{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.txn_no} · {formatDate(t.txn_date)} · {TXN_KIND_LABEL[t.kind]}
                        {t.kind === "transfer" ? ` · ${t.cash_bank_name} ke ${t.to_cash_bank_name}` : ` · ${t.cash_bank_name}${t.account_name ? ` · ${t.account_name}` : ""}`}
                        {t.void_reason && ` · batal: ${t.void_reason}`}
                      </p>
                    </div>
                    <span className={cn("font-semibold tabular-nums", incoming && "text-brand-blue-fg")}>
                      {incoming ? "+" : t.kind === "transfer" ? "" : "-"}
                      {formatRupiah(t.amount)}
                    </span>
                    <AttachmentButton entityType="cash_transaction" entityId={t.id} title={`Bukti ${t.txn_no}`} canEdit={can(ctx, "expenses", "create", false)} />
                    {t.status === "posted" && (can(ctx, "expenses", "void", false) || can(ctx, "journal", "void", false)) && <VoidTxnButton id={t.id} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canExpenses && (
          <section className={cn(panel, "grid content-start gap-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Biaya rutin bulanan</h2>
              {canCreate && <RecurringDialog accounts={accounts} cashAccounts={balances} />}
            </div>
            {recurring.length === 0 ? (
              <EmptyState icon={Repeat} text="Belum ada template. Tambahkan sewa, listrik, atau internet agar tinggal dikonfirmasi tiap bulan." />
            ) : (
              <ul className="grid divide-y divide-border">
                {recurring.map((r) => (
                  <li key={r.id} className={cn("grid gap-1 py-3", !r.is_active && "opacity-60")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{r.name}</p>
                      <span className="font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.account_name} · dari {r.cash_bank_name} · tiap tanggal {r.day_of_month}
                      {r.last_confirmed_on && ` · terakhir ${formatDate(r.last_confirmed_on)}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      {r.is_active && !r.confirmed_this_month && canCreate && <ConfirmRecurringDialog item={r} today={today} />}
                      {r.is_active && r.confirmed_this_month && (
                        <span className="rounded-sm bg-brand-blue-soft px-2 py-0.5 text-xs font-medium text-brand-blue-fg">Sudah dikonfirmasi bulan ini</span>
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
          </section>
        )}
      </div>
    </>
  );
}
