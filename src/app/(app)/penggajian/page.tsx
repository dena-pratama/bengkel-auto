import { Suspense } from "react";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  Wallet,
} from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { ListFilter } from "@/components/list-filter";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { listPayrollPeriods } from "@/lib/payroll";
import { STATUS_LABEL } from "@/lib/validation/payroll";
import { cn } from "@/lib/utils";
import { PeriodDialog } from "./_components/forms";
import { PayrollNav, PayrollStatusBadge } from "./_components/ui";

export default function PayrollPage({ searchParams }: PageProps<"/penggajian">) {
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
  if (!can(ctx, "payroll", "view")) return <NoAccess />;
  const all = can(ctx, "payroll", "view", false);
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "tahun-ini");
  const statuses = Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[];
  const status = readOption(sp, "status", statuses);
  const type = readOption(sp, "jenis", ["monthly", "weekly"] as const);
  const periods = await listPayrollPeriods({ from: range.from, to: range.to, status, type });
  const openPeriods = periods.filter((p) => p.status === "draft" || p.status === "review" || p.status === "approved");
  const open = openPeriods.length;

  // Metric summaries matching Figma 09 · Penggajian
  const paidPeriods = periods.filter((p) => p.status === "paid");
  const totalPaid = paidPeriods.reduce((sum, p) => sum + p.net, 0);
  const pendingTotal = openPeriods.reduce((sum, p) => sum + p.net, 0);
  const latestPeriod = periods[0] ?? null;
  const avgPaid = paidPeriods.length > 0 ? Math.round(totalPaid / paidPeriods.length) : 0;

  return (
    <>
      <PayrollNav active="periods" showAll={all} />
      <PageHeader
        title={all ? "Penggajian" : "Slip gaji saya"}
        description={
          all
            ? `${describeRange(range, formatDate)} · ${periods.length} periode · ${open} belum dibayar`
            : "Slip tampil setelah gaji disetujui Owner."
        }
        actions={can(ctx, "payroll", "create", false) && <PeriodDialog today={todayWib()} />}
      />

      {/* 4 Summary Stat Cards matching Figma */}
      {all && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
              <Wallet className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total periode terkini</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">
                {latestPeriod ? formatRupiah(latestPeriod.net) : "Rp 0"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {latestPeriod ? `${latestPeriod.slips} karyawan · ${latestPeriod.label}` : "Belum ada periode"}
              </p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
              <Clock className="size-5 text-brand-sand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Menunggu dibayar</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">
                {open} periode
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {open > 0 ? `${formatRupiah(pendingTotal)} · perlu diproses` : "Semua dibayar"}
              </p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
              <CheckCircle2 className="size-5 text-brand-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sudah dibayar tahun ini</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl text-brand-green">
                {formatRupiah(totalPaid)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {paidPeriods.length} dari {periods.length} periode
              </p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted">
              <Banknote className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Rata-rata per periode</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">
                {formatRupiah(avgPaid)}
              </p>
              <p className="text-[11px] text-muted-foreground">akumulasi periode lunas</p>
            </div>
          </div>
        </section>
      )}

      <ListFilter
        today={today}
        range={range}
        defaultRange="tahun-ini"
        dateLabel="Periode gaji"
        selects={[
          {
            name: "status",
            label: "Status",
            value: status,
            options: statuses.map((v) => ({ value: v, label: STATUS_LABEL[v] })),
            allLabel: "Semua status",
          },
          {
            name: "jenis",
            label: "Jenis periode",
            value: type,
            options: [
              { value: "monthly", label: "Bulanan" },
              { value: "weekly", label: "Mingguan" },
            ],
            allLabel: "Semua jenis",
          },
        ]}
      />

      <section className={cn(panel, "overflow-hidden p-4 sm:p-5")}>
        {periods.length === 0 ? (
          <EmptyState
            icon={Banknote}
            text={
              all
                ? "Belum ada periode gaji. Atur profil gaji karyawan lebih dulu, lalu buat periode."
                : "Belum ada slip gaji."
            }
          />
        ) : (
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pt-1">Periode</th>
                  <th className="pb-3 pt-1">Jenis</th>
                  <th className="pb-3 pt-1">Karyawan</th>
                  {all && <th className="pb-3 pt-1 text-right">Total Gaji</th>}
                  <th className="pb-3 pt-1">Dibayar</th>
                  <th className="pb-3 pt-1">Status</th>
                  <th className="pb-3 pt-1 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periods.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-muted/40">
                    <td className="py-3.5 pr-3">
                      <Link href={`/penggajian/${p.id}`} className="group block">
                        <p className="font-semibold text-foreground group-hover:text-brand-rail">
                          {p.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.period_no} · {formatDate(p.start_date)} s/d {formatDate(p.end_date)}
                        </p>
                      </Link>
                    </td>
                    <td className="py-3.5 pr-3 text-xs text-muted-foreground">
                      {p.period_type === "monthly" ? "Bulanan" : "Mingguan"}
                    </td>
                    <td className="py-3.5 pr-3 text-xs">
                      <span className="font-medium text-foreground">{p.slips}</span> orang
                    </td>
                    {all && (
                      <td className="py-3.5 pr-3 text-right">
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatRupiah(p.net)}
                        </span>
                      </td>
                    )}
                    <td className="py-3.5 pr-3 text-xs text-muted-foreground">
                      {p.paid_date ? formatDate(p.paid_date) : "-"}
                    </td>
                    <td className="py-3.5 pr-3">
                      <PayrollStatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={`/penggajian/${p.id}`}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Buka ${p.label}`}
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
