import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listAccounts, listFiscalPeriods, listJournalMonths } from "@/lib/finance";
import { formatDateTime, todayWib } from "@/lib/format";
import { ACCOUNT_TYPE_LABEL } from "@/lib/validation/finance";
import { cn } from "@/lib/utils";
import { AccountDialog, PeriodControls, ToggleAccountButton } from "../_components/dialogs";
import { FinanceNav } from "../_components/ui";

export default function AccountsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

async function Content() {
  const ctx = await requireUser();
  const canReports = can(ctx, "finance_reports", "view", false);
  if (!canReports && !can(ctx, "journal", "view", false)) return <NoAccess />;
  const canEdit = can(ctx, "journal", "update", false);
  const [accounts, periods, months] = await Promise.all([listAccounts(), listFiscalPeriods(), listJournalMonths()]);
  const thisMonth = todayWib().slice(0, 7);
  const closed = new Map(periods.map((p) => [`${p.period_year}-${String(p.period_month).padStart(2, "0")}`, p]));
  const rows = [...new Set([...months, ...periods.map((p) => `${p.period_year}-${String(p.period_month).padStart(2, "0")}`)])].filter((m) => m < thisMonth).sort().reverse();
  // Bulan hanya bisa ditutup jika semua bulan sebelumnya yang punya jurnal sudah tertutup
  const ascending = [...rows].reverse();
  const firstOpen = ascending.find((m) => !closed.get(m)?.is_closed);

  const groups = (Object.keys(ACCOUNT_TYPE_LABEL) as (keyof typeof ACCOUNT_TYPE_LABEL)[]).map((t) => ({ type: t, items: accounts.filter((a) => a.type === t) }));

  return (
    <>
      <FinanceNav active="accounts" showReports={canReports} showLedger />
      <PageHeader title="Akun & tutup buku" description="Bagan akun, dan penguncian bulan yang sudah selesai." actions={can(ctx, "journal", "create", false) && <AccountDialog />} />

      <section className={cn(panel, "grid gap-3 p-4 sm:p-6")}>
        <h2 className="text-lg font-semibold">Tutup buku bulanan</h2>
        <p className="text-sm text-muted-foreground">Bulan yang ditutup terkunci: tidak ada jurnal baru bertanggal di bulan itu. Tutup berurutan dari bulan yang paling lama.</p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada bulan yang bisa ditutup. Bulan berjalan baru bisa ditutup setelah berganti bulan.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {rows.map((m) => {
              const [y, mo] = m.split("-").map(Number);
              const p = closed.get(m);
              const isClosed = Boolean(p?.is_closed);
              return (
                <li key={m} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {MONTHS[mo - 1]} {y}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isClosed ? `Ditutup ${formatDateTime(p!.closed_at)}` : p?.reopen_reason ? `Dibuka kembali: ${p.reopen_reason}` : "Terbuka"}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", isClosed ? "bg-brand-rail text-white" : "bg-brand-sand-soft")}>{isClosed ? "Terkunci" : "Terbuka"}</span>
                  <PeriodControls year={y} month={mo} closed={isClosed} canClose={canEdit && m === firstOpen} canReopen={ctx.is_superuser} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {groups.map((g) => (
        <section key={g.type} className={cn(panel, "grid gap-2 p-4 sm:p-6")}>
          <h2 className="text-lg font-semibold">{ACCOUNT_TYPE_LABEL[g.type]}</h2>
          <ul className="grid divide-y divide-border">
            {g.items.map((a) => (
              <li key={a.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5", !a.is_active && "opacity-60")}>
                <span className="w-20 font-mono text-sm text-muted-foreground">{a.code}</span>
                <span className="min-w-0 flex-1 text-sm font-medium">{a.name}</span>
                {a.system_key && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">Akun sistem</span>}
                {canEdit && (
                  <span className="flex gap-1">
                    <AccountDialog item={a} />
                    {!a.system_key && <ToggleAccountButton id={a.id} active={a.is_active} />}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
