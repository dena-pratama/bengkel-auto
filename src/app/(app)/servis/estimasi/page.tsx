import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { addDays, formatDate, formatRupiah, todayWib } from "@/lib/format";
import { listCatalog, listEstimates, listVehicleOptions } from "@/lib/service";
import { cn } from "@/lib/utils";
import { NewEstimateDialog } from "../_components/dialogs";
import { EstimateStatusBadge, ServiceNav } from "../_components/ui";

export default function EstimatesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "service_orders", "view", false)) return <NoAccess />;
  const canCreate = can(ctx, "service_orders", "create", false);
  const [estimates, vehicles, catalog] = await Promise.all([
    listEstimates(),
    canCreate ? listVehicleOptions() : Promise.resolve([]),
    canCreate ? listCatalog() : Promise.resolve([]),
  ]);
  const today = todayWib();
  const waiting = estimates.filter((e) => e.status === "draft" || e.status === "sent").length;

  return (
    <>
      <ServiceNav active="estimates" showEstimates />
      <PageHeader
        title="Estimasi"
        description={`${waiting} estimasi menunggu keputusan pelanggan`}
        actions={canCreate && <NewEstimateDialog vehicles={vehicles} catalog={catalog} validUntil={addDays(today, 7)} />}
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
