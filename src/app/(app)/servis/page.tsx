import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { addDays, todayWib } from "@/lib/format";
import { listCatalog, listVehicleOptions, listWorkOrders } from "@/lib/service";
import { BOARD_STATUSES } from "@/lib/validation/service";
import { ServiceBoard } from "./_components/board";
import { NewEstimateDialog } from "./_components/dialogs";
import { ServiceNav } from "./_components/ui";

export default function ServicePage() {
  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "service_orders", "view") && !can(ctx, "service_board", "view")) return <NoAccess />;
  const canCreate = can(ctx, "service_orders", "create", false);
  const [orders, vehicles, catalog] = await Promise.all([
    listWorkOrders(),
    canCreate ? listVehicleOptions() : Promise.resolve([]),
    canCreate ? listCatalog() : Promise.resolve([]),
  ]);
  const active = orders.filter((o) => BOARD_STATUSES.includes(o.status));
  const overdue = active.filter((o) => o.is_overdue).length;

  return (
    <>
      <ServiceNav active="board" showEstimates={can(ctx, "service_orders", "view", false)} />
      <PageHeader
        title="Servis & work order"
        description={`${active.length} kendaraan di bengkel${overdue ? ` · ${overdue} lewat estimasi waktu` : ""}`}
        actions={canCreate && <NewEstimateDialog vehicles={vehicles} catalog={catalog} validUntil={addDays(todayWib(), 7)} />}
      />
      <ServiceBoard orders={orders} showMoney={can(ctx, "service_orders", "view", false)} />
    </>
  );
}
