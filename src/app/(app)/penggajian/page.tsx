import { Suspense } from "react";
import Link from "next/link";
import { Banknote, ChevronRight } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { listPayrollPeriods } from "@/lib/payroll";
import { cn } from "@/lib/utils";
import { PeriodDialog } from "./_components/forms";
import { PayrollNav, PayrollStatusBadge } from "./_components/ui";

export default function PayrollPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "payroll", "view")) return <NoAccess />;
  const all = can(ctx, "payroll", "view", false);
  const periods = await listPayrollPeriods();
  const open = periods.filter((p) => p.status === "draft" || p.status === "review" || p.status === "approved").length;

  return (
    <>
      <PayrollNav active="periods" showAll={all} />
      <PageHeader
        title={all ? "Penggajian" : "Slip gaji saya"}
        description={all ? `${open} periode belum dibayar` : "Slip tampil setelah gaji disetujui Owner."}
        actions={can(ctx, "payroll", "create", false) && <PeriodDialog today={todayWib()} />}
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
