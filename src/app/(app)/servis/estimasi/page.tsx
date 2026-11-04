import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { addDays, formatDate, formatRupiah, todayWib } from "@/lib/format";
import { ListFilter } from "@/components/list-filter";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { listCatalog, listEstimates, listVehicleOptions } from "@/lib/service";
import { ESTIMATE_STATUSES, ESTIMATE_STATUS_LABEL } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { NewEstimateDialog } from "../_components/dialogs";
import { EstimateStatusBadge, ServiceNav } from "../_components/ui";

export default function EstimatesPage({ searchParams }: PageProps<"/servis/estimasi">) {
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
  if (!can(ctx, "service_orders", "view", false)) return <NoAccess />;
  const canCreate = can(ctx, "service_orders", "create", false);
  const sp = await searchParams;
  const todayStr = todayWib();
  const range = readRange(sp, todayStr, "30-hari");
  const status = readOption(sp, "status", ESTIMATE_STATUSES);
  const [estimates, vehicles, catalog] = await Promise.all([
    listEstimates({ from: range.from, to: range.to, status }),
    canCreate ? listVehicleOptions() : Promise.resolve([]),
    canCreate ? listCatalog() : Promise.resolve([]),
  ]);
  const today = todayWib();
  const waiting = estimates.filter((e) => e.status === "draft" || e.status === "sent").length;

  return (
    <>
      <ServiceNav active="estimates" showEstimates showWarranty={can(ctx, "finance_reports", "view", false)} />
      <PageHeader
        title="Estimasi"
        description={`${describeRange(range, formatDate)} · ${estimates.length} estimasi · ${waiting} menunggu keputusan pelanggan`}
        actions={canCreate && <NewEstimateDialog vehicles={vehicles} catalog={catalog} validUntil={addDays(today, 7)} />}
      />
      <ListFilter
        today={todayStr}
        range={range}
        defaultRange="30-hari"
        dateLabel="Tanggal dibuat"
        selects={[{ name: "status", label: "Status", value: status, options: ESTIMATE_STATUSES.map((v) => ({ value: v, label: ESTIMATE_STATUS_LABEL[v] })), allLabel: "Semua status" }]}
      />
      <section className={cn(panel, "p-4 sm:p-5")}>
        {estimates.length === 0 ? (
          <EmptyState icon={ClipboardList} text="Belum ada estimasi. Setiap servis dimulai dari estimasi yang disetujui pelanggan." />
        ) : (
          <ul className="grid divide-y divide-border">
            {estimates.map((e) => {
              const expired = (e.status === "draft" || e.status === "sent") && e.valid_until < today;
              return (
                <li key={e.id}>
                  <Link href={`/servis/estimasi/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold">
                        {e.plate_no}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {e.estimate_no}
                          {e.version > 1 && ` rev ${e.version}`}
                        </span>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[e.customer_name, e.complaint].filter(Boolean).join(" · ") || "Tanpa keluhan"} · {formatDate(e.created_at)}
                      </p>
                    </div>
                    {expired && <span className="rounded-sm bg-brand-red-soft px-2 py-0.5 text-xs font-medium text-brand-red">Kedaluwarsa</span>}
                    <EstimateStatusBadge status={e.status} />
                    <span className="w-32 text-right font-semibold tabular-nums">{formatRupiah(e.total)}</span>
                    <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
