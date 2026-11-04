import { Suspense } from "react";
import Link from "next/link";
import { Banknote, ChevronRight } from "lucide-react";
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
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
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
  const open = periods.filter((p) => p.status === "draft" || p.status === "review" || p.status === "approved").length;

  return (
    <>
      <PayrollNav active="periods" showAll={all} />
      <PageHeader
        title={all ? "Penggajian" : "Slip gaji saya"}
        description={all ? `${describeRange(range, formatDate)} · ${periods.length} periode · ${open} belum dibayar` : "Slip tampil setelah gaji disetujui Owner."}
        actions={can(ctx, "payroll", "create", false) && <PeriodDialog today={todayWib()} />}
      />
      <ListFilter
        today={today}
        range={range}
        defaultRange="tahun-ini"
        dateLabel="Periode gaji"
        selects={[
          { name: "status", label: "Status", value: status, options: statuses.map((v) => ({ value: v, label: STATUS_LABEL[v] })), allLabel: "Semua status" },
          { name: "jenis", label: "Jenis periode", value: type, options: [{ value: "monthly", label: "Bulanan" }, { value: "weekly", label: "Mingguan" }], allLabel: "Semua jenis" },
        ]}
      />
      <section className={cn(panel, "p-4 sm:p-5")}>
        {periods.length === 0 ? (
          <EmptyState icon={Banknote} text={all ? "Belum ada periode gaji. Atur profil gaji karyawan lebih dulu, lalu buat periode." : "Belum ada slip gaji."} />
        ) : (
          <ul className="grid divide-y divide-border">
            {periods.map((p) => (
              <li key={p.id}>
                <Link href={`/penggajian/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {p.period_no} · {formatDate(p.start_date)} s/d {formatDate(p.end_date)} · {p.slips} slip
                      {p.paid_date && ` · dibayar ${formatDate(p.paid_date)}`}
                    </p>
                  </div>
                  <PayrollStatusBadge status={p.status} />
                  {all && <span className="w-36 text-right font-semibold tabular-nums">{formatRupiah(p.net)}</span>}
                  <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
