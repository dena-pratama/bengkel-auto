import { Suspense } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { can, requireUser } from "@/lib/auth";
import { getLedger, listAccounts, listJournal } from "@/lib/finance";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/validation/finance";
import { cn } from "@/lib/utils";
import { ManualJournalDialog, ReverseJournalButton } from "../_components/dialogs";
import { DATE, FinanceNav, UUID, monthRange } from "../_components/ui";

export default function JournalPage({ searchParams }: PageProps<"/keuangan/jurnal">) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  const canReports = can(ctx, "finance_reports", "view", false);
  if (!canReports && !can(ctx, "journal", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const month = monthRange(today);
  const from = DATE.test(pick(sp.dari) ?? "") ? pick(sp.dari)! : month.from;
  const to = DATE.test(pick(sp.sampai) ?? "") && pick(sp.sampai)! >= from ? pick(sp.sampai)! : month.to;
  const source = pick(sp.sumber) && SOURCE_LABEL[pick(sp.sumber)!] ? pick(sp.sumber)! : null;
  const accountId = UUID.test(pick(sp.akun) ?? "") ? pick(sp.akun)! : null;
  const accounts = await listAccounts();
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const canCreate = can(ctx, "journal", "create", false);

  return (
    <>
      <FinanceNav active="journal" showReports={canReports} showLedger />
      <PageHeader
        title={account ? `Buku besar ${account.code} ${account.name}` : "Jurnal umum"}
        description={`${formatDate(from)} s/d ${formatDate(to)}`}
        back={account ? { href: `/keuangan/jurnal?dari=${from}&sampai=${to}`, label: "Jurnal umum" } : undefined}
        actions={canCreate && !account && <ManualJournalDialog accounts={accounts} today={today} />}
      />

      <section className={cn(panel, "p-4 sm:p-5")}>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Dari
            <input type="date" name="dari" defaultValue={from} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Sampai
            <input type="date" name="sampai" defaultValue={to} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Akun (buku besar)
            <select name="akun" defaultValue={accountId ?? ""} className={cn(inputClass, "min-w-56")}>
              <option value="">Semua (jurnal umum)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
          </label>
          {!account && (
            <label className="grid gap-1.5 text-sm font-medium">
              Sumber
              <select name="sumber" defaultValue={source ?? ""} className={inputClass}>
                <option value="">Semua sumber</option>
                {Object.entries(SOURCE_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit">Tampilkan</Button>
        </form>
      </section>

      <Suspense fallback={<Skeleton className="h-96" />}>
        {account ? <Ledger accountId={account.id} from={from} to={to} /> : <Entries from={from} to={to} source={source} canReverse={can(ctx, "journal", "void", false)} />}
      </Suspense>
    </>
  );
}

async function Entries({ from, to, source, canReverse }: { from: string; to: string; source: string | null; canReverse: boolean }) {
  const entries = await listJournal(from, to, source);
  return (
    <section className={cn(panel, "grid gap-3 p-4 sm:p-6")}>
      {entries.length === 0 ? (
        <EmptyState icon={BookOpen} text="Tidak ada jurnal pada periode ini." />
      ) : (
        <ul className="grid gap-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-2xl border border-border">
              <details className="group">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 select-none">
                  <span className="font-mono text-sm font-semibold">{e.entry_no}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{e.description}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{SOURCE_LABEL[e.source_type] ?? e.source_type}</span>
                  {e.reversal_of && <span className="rounded-full bg-brand-sand-soft px-2.5 py-0.5 text-xs font-medium">Pembalik</span>}
                  {e.is_reversed && <span className="rounded-full bg-brand-red-soft px-2.5 py-0.5 text-xs font-medium text-brand-red">Sudah dibalik</span>}
                  <span className="text-xs text-muted-foreground">{formatDate(e.entry_date)}</span>
                  <span className="w-32 text-right text-sm font-semibold tabular-nums">{formatRupiah(e.total)}</span>
                </summary>
                <div className="grid gap-2 border-t border-border px-4 py-3">
                  <table className="w-full text-sm">
                    <tbody>
                      {e.lines.map((l, i) => (
                        <tr key={i}>
                          <td className={cn("py-1", l.credit > 0 && "pl-6")}>
                            <Link href={`/keuangan/jurnal?akun=${l.account_id}&dari=${from}&sampai=${to}`} className="hover:underline">
                              <span className="font-mono text-xs text-muted-foreground">{l.accounts.code}</span> {l.accounts.name}
                            </Link>
                            {l.memo && <span className="text-xs text-muted-foreground"> · {l.memo}</span>}
                          </td>
                          <td className="w-32 py-1 text-right tabular-nums">{l.debit > 0 ? formatRupiah(l.debit) : ""}</td>
                          <td className="w-32 py-1 text-right tabular-nums">{l.credit > 0 ? formatRupiah(l.credit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {canReverse && e.source_type === "manual" && !e.reversal_of && !e.is_reversed && (
                    <div>
                      <ReverseJournalButton id={e.id} />
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {entries.length === 200 && <p className="text-xs text-muted-foreground">Menampilkan 200 jurnal terbaru. Persempit periode untuk melihat yang lain.</p>}
    </section>
  );
}

async function Ledger({ accountId, from, to }: { accountId: string; from: string; to: string }) {
  const rows = await getLedger(accountId, from, to);
  return (
    <section className={cn(panel, "overflow-x-auto p-4 sm:p-6")}>
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Tanggal</th>
            <th className="py-2 font-medium">Jurnal</th>
            <th className="py-2 font-medium">Keterangan</th>
            <th className="py-2 text-right font-medium">Debit</th>
            <th className="py-2 text-right font-medium">Kredit</th>
            <th className="py-2 text-right font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ord} className={cn("border-b border-border/60 last:border-0", r.ord === 0 && "bg-muted/60 font-semibold")}>
              <td className="py-2">{r.entry_date ? formatDate(r.entry_date) : ""}</td>
              <td className="py-2 font-mono text-xs">{r.entry_no}</td>
              <td className="py-2">
                {r.description}
                {r.memo && <span className="text-xs text-muted-foreground"> · {r.memo}</span>}
                {r.source_type && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{SOURCE_LABEL[r.source_type] ?? r.source_type}</span>}
              </td>
              <td className="py-2 text-right tabular-nums">{r.debit > 0 ? formatRupiah(r.debit) : ""}</td>
              <td className="py-2 text-right tabular-nums">{r.credit > 0 ? formatRupiah(r.credit) : ""}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 1 && <p className="pt-3 text-center text-sm text-muted-foreground">Tidak ada mutasi pada periode ini.</p>}
    </section>
  );
}
