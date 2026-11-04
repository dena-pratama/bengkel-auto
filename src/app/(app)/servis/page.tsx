import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ListFilter } from "@/components/list-filter";
import { addDays, formatDate, todayWib } from "@/lib/format";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { listCatalog, listVehicleOptions, listWorkOrders } from "@/lib/service";
import { BOARD_STATUSES } from "@/lib/validation/service";
import { ServiceBoard } from "./_components/board";
import { NewEstimateDialog } from "./_components/dialogs";
import { ServiceNav } from "./_components/ui";

export default function ServicePage({ searchParams }: PageProps<"/servis">) {
  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "service_orders", "view") && !can(ctx, "service_board", "view")) return <NoAccess />;
  const canCreate = can(ctx, "service_orders", "create", false);
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "30-hari");
  const done = readOption(sp, "hasil", ["delivered", "void"] as const);
  const [orders, vehicles, catalog] = await Promise.all([
    listWorkOrders({ from: range.from, to: range.to, done }),
    canCreate ? listVehicleOptions() : Promise.resolve([]),
    canCreate ? listCatalog() : Promise.resolve([]),
  ]);
  const active = orders.filter((o) => BOARD_STATUSES.includes(o.status));
  const overdue = active.filter((o) => o.is_overdue).length;

  return (
    <>
      <ServiceNav active="board" showEstimates={can(ctx, "service_orders", "view", false)} showWarranty={can(ctx, "finance_reports", "view", false)} />
      <PageHeader
        title="Servis & work order"
        description={`${active.length} kendaraan di bengkel${overdue ? ` · ${overdue} lewat estimasi waktu` : ""}`}
        actions={canCreate && <NewEstimateDialog vehicles={vehicles} catalog={catalog} validUntil={addDays(todayWib(), 7)} />}
      />
      <ServiceBoard
        orders={orders}
        showMoney={can(ctx, "service_orders", "view", false)}
        historyTitle={`Selesai & batal · ${describeRange(range, formatDate)}`}
        historyFilter={
          <ListFilter
            today={today}
            range={range}
            defaultRange="30-hari"
            dateLabel="Tanggal selesai atau batal"
            selects={[{ name: "hasil", label: "Hasil", value: done, options: [{ value: "delivered", label: "Selesai diserahkan" }, { value: "void", label: "Dibatalkan" }], allLabel: "Selesai dan batal" }]}
          />
        }
      />
    </>
  );
}
