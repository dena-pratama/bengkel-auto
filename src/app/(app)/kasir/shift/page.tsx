import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Timer } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ListFilter } from "@/components/list-filter";
import { listShifts } from "@/lib/cashier";
import { formatDate, todayWib } from "@/lib/format";
import { readOption, readRange, describeRange } from "@/lib/list-filter";
import { SHIFT_STATUS_FILTERS, SHIFT_STATUS_FILTER_LABEL } from "@/lib/validation/cashier";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CashierNav } from "../_components/ui";
import { ShiftStatusBadge } from "../_components/shift-ui";

export default function ShiftsPage({ searchParams }: PageProps<"/kasir/shift">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CashierNav active="shifts" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "cash_shift", "view", false) && !can(ctx, "cash_shift", "approve", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "bulan-ini");
  const status = readOption(sp, "status", SHIFT_STATUS_FILTERS);
  const shifts = await listShifts({ from: range.from, to: range.to, status });
  const waiting = shifts.filter((s) => s.status === "closed").length;
  return (
    <>
      <PageHeader title="Shift kas" description={`${describeRange(range, formatDate)} · ${shifts.length} shift${waiting ? ` · ${waiting} menunggu persetujuan` : ""}`} />
      <ListFilter
        today={today}
        range={range}
        defaultRange="bulan-ini"
        dateLabel="Tanggal buka shift"
        selects={[{ name: "status", label: "Status", value: status, options: SHIFT_STATUS_FILTERS.map((v) => ({ value: v, label: SHIFT_STATUS_FILTER_LABEL[v] })), allLabel: "Semua status" }]}
      />
      <section className={cn(panel, "p-4 sm:p-5")}>
        {shifts.length === 0 ? (
          <EmptyState icon={Timer} text="Belum ada shift." />
        ) : (
          <ul className="grid divide-y divide-border">
            {shifts.map((s) => (
              <li key={s.id}>
                <Link href={`/kasir/shift/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">
                      {s.shift_no} <span className="font-normal text-muted-foreground">· {s.cashier_name}</span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {formatDateTime(s.opened_at)}
                      {s.closed_at && ` s/d ${formatDateTime(s.closed_at)}`}
                    </p>
                  </div>
                  {s.variance != null && s.variance !== 0 && <span className="text-sm font-medium text-brand-red tabular-nums">Selisih {formatRupiah(s.variance)}</span>}
                  <ShiftStatusBadge status={s.status} />
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
