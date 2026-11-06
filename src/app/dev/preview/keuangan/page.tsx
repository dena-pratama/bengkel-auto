import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
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
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { CashBankBalance, CashTransaction, RecurringExpense } from "@/lib/finance";
import { formatDate, formatRupiah } from "@/lib/format";
import { TXN_KIND_LABEL } from "@/lib/validation/finance";
import { cn } from "@/lib/utils";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Keuangan", position: "Finance & Accounting", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "Finance Admin" }],
  permissions: [],
};

const SAMPLE_BALANCES: CashBankBalance[] = [
  {
    cash_bank_account_id: "cba-1",
    name: "Kas Laci",
    kind: "cash",
    bank_name: null,
    account_number: null,
    is_active: true,
    balance: 4820000,
  },
  {
    cash_bank_account_id: "cba-2",
    name: "Bank BCA",
    kind: "bank",
    bank_name: "BCA",
    account_number: "4812-9901-22",
    is_active: true,
    balance: 33580000,
  },
  {
    cash_bank_account_id: "cba-3",
    name: "Bank Mandiri Operasional",
    kind: "bank",
    bank_name: "Mandiri",
    account_number: "132-00-981244-1",
    is_active: true,
    balance: 14250000,
  },
];

const SAMPLE_TXNS: CashTransaction[] = [
  {
    id: "ctx-1",
    txn_no: "KK-2611-0012",
    txn_date: "2026-11-04",
    kind: "expense",
    cash_bank_account_id: "cba-1",
    cash_bank_name: "Kas Laci",
    to_cash_bank_name: null,
    account_code: "6-1100",
    account_name: "Beban Listrik & Air",
    amount: 750000,
    description: "Token listrik bengkel 500 kWh",
    recurring_id: "rec-1",
    status: "posted",
    void_reason: null,
  },
  {
    id: "ctx-2",
    txn_no: "KM-2611-0008",
    txn_date: "2026-11-04",
    kind: "income",
    cash_bank_account_id: "cba-2",
    cash_bank_name: "Bank BCA",
    to_cash_bank_name: null,
    account_code: "7-1100",
    account_name: "Pendapatan Lain-lain",
    amount: 1200000,
    description: "Penjualan oli drum bekas & besi tua",
    recurring_id: null,
    status: "posted",
    void_reason: null,
  },
  {
    id: "ctx-3",
    txn_no: "TR-2611-0004",
    txn_date: "2026-11-03",
    kind: "transfer",
    cash_bank_account_id: "cba-1",
    cash_bank_name: "Kas Laci",
    to_cash_bank_name: "Bank BCA",
    account_code: null,
    account_name: null,
    amount: 3000000,
    description: "Setor sisa kas shift akhir pekan ke bank",
    recurring_id: null,
    status: "posted",
    void_reason: null,
  },
  {
    id: "ctx-4",
    txn_no: "KK-2611-0011",
    txn_date: "2026-11-02",
    kind: "expense",
    cash_bank_account_id: "cba-1",
    cash_bank_name: "Kas Laci",
    to_cash_bank_name: null,
    account_code: "6-1200",
    account_name: "Beban Operasional Toko",
    amount: 145000,
    description: "Beli galon & konsumsi makan siang mekanik",
    recurring_id: null,
    status: "posted",
    void_reason: null,
  },
  {
    id: "ctx-5",
    txn_no: "KM-2611-0007",
    txn_date: "2026-11-01",
    kind: "capital",
    cash_bank_account_id: "cba-2",
    cash_bank_name: "Bank BCA",
    to_cash_bank_name: null,
    account_code: "3-1000",
    account_name: "Modal Disetor",
    amount: 15000000,
    description: "Tambahan modal kerja owner",
    recurring_id: null,
    status: "posted",
    void_reason: null,
  },
];

const SAMPLE_RECURRING: RecurringExpense[] = [
  {
    id: "rec-1",
    name: "Listrik PLN Pascabayar",
    account_id: "acc-1",
    account_name: "Beban Listrik & Air",
    cash_bank_account_id: "cba-1",
    cash_bank_name: "Kas Laci",
    amount: 1500000,
    day_of_month: 10,
    is_active: true,
    confirmed_this_month: false,
    last_confirmed_on: "2026-10-10",
  },
  {
    id: "rec-2",
    name: "Internet & WiFi Biznet",
    account_id: "acc-2",
    account_name: "Beban Komunikasi & Internet",
    cash_bank_account_id: "cba-2",
    cash_bank_name: "Bank BCA",
    amount: 750000,
    day_of_month: 15,
    is_active: true,
    confirmed_this_month: false,
    last_confirmed_on: "2026-10-15",
  },
  {
    id: "rec-3",
    name: "Sewa Gedung Bengkel (Cicilan)",
    account_id: "acc-3",
    account_name: "Beban Sewa Gedung",
    cash_bank_account_id: "cba-2",
    cash_bank_name: "Bank BCA",
    amount: 6500000,
    day_of_month: 1,
    is_active: true,
    confirmed_this_month: true,
    last_confirmed_on: "2026-11-01",
  },
];

export default function FinancePreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau keuangan...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  const total = SAMPLE_BALANCES.filter((b) => b.is_active).reduce((t, b) => t + b.balance, 0);
  const dueRecurring = SAMPLE_RECURRING.filter((r) => r.is_active && !r.confirmed_this_month);
  const dueRecurringTotal = dueRecurring.reduce((s, r) => s + r.amount, 0);
  const totalMonthlyRecurring = SAMPLE_RECURRING.filter((r) => r.is_active).reduce((s, r) => s + r.amount, 0);

  const totalIncome = SAMPLE_TXNS.filter(
    (t) => t.status !== "void" && (t.kind === "income" || t.kind === "capital")
  ).reduce((s, t) => s + t.amount, 0);

  const totalExpense = SAMPLE_TXNS.filter(
    (t) => t.status !== "void" && (t.kind === "expense" || t.kind === "drawing")
  ).reduce((s, t) => s + t.amount, 0);

  const netCashflow = totalIncome - totalExpense;

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <PageHeader
          title="Kas & bank"
          description={`Total saldo ${formatRupiah(total)} · ${dueRecurring.length} biaya rutin menunggu konfirmasi`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-rail px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-rail/90"
              >
                <ArrowUpFromLine className="size-3.5" />
                Pengeluaran
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                <ArrowDownToLine className="size-3.5" />
                Pemasukan lain
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Transfer antar akun
              </button>
            </div>
          }
        />

        {/* Accounts Grid */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SAMPLE_BALANCES.map((b) => (
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

        {/* Content Row */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Left: Transaksi Kas */}
          <section className={cn(panel, "grid content-start gap-3 p-4 sm:p-5")}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-semibold">Transaksi kas</h2>
                <p className="text-xs text-muted-foreground">30 hari terakhir · {SAMPLE_TXNS.length} transaksi</p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Download className="size-3.5" />
                Ekspor
              </button>
            </div>

            <div className="overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2.5 pt-1">Transaksi</th>
                    <th className="pb-2.5 pt-1">Akun</th>
                    <th className="pb-2.5 pt-1">Tanggal</th>
                    <th className="pb-2.5 pt-1 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SAMPLE_TXNS.map((t) => {
                    const incoming = t.kind === "income" || t.kind === "capital";
                    return (
                      <tr key={t.id} className="transition-colors hover:bg-muted/40">
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
                            <span className="font-medium">{t.description}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{t.txn_no}</p>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right: Biaya Rutin Bulanan */}
          <section className={cn(panel, "flex flex-col justify-between gap-4 p-4 sm:p-5")}>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="text-lg font-semibold">Biaya rutin bulanan</h2>
                  <p className="text-xs text-muted-foreground">Template pengeluaran berkala per bulan</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-rail px-3 text-xs font-semibold text-white shadow-sm hover:bg-brand-rail/90"
                >
                  <Plus className="size-3.5" />
                  Biaya rutin
                </button>
              </div>

              <ul className="grid divide-y divide-border">
                {SAMPLE_RECURRING.map((r) => (
                  <li key={r.id} className="grid gap-1.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{r.name}</p>
                      <span className="font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.account_name} · dari {r.cash_bank_name} · tiap tgl {r.day_of_month}
                      {r.last_confirmed_on && ` · terakhir ${formatDate(r.last_confirmed_on)}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {r.confirmed_this_month ? (
                        <span className="rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green">
                          Sudah dikonfirmasi bulan ini
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center rounded-lg bg-brand-rail px-2.5 text-xs font-medium text-white shadow-sm hover:bg-brand-rail/90"
                        >
                          Konfirmasi bulan ini
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3 text-xs">
              <span className="text-muted-foreground">Total biaya rutin / bulan</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatRupiah(totalMonthlyRecurring)}
              </span>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
