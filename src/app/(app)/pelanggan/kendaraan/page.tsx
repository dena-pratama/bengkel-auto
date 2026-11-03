import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listCustomers, listVehicleModels, listVehicles } from "@/lib/customers";
import { NewVehicleDialog } from "../_components/dialogs";
import { CustomersNav, VehiclesList } from "../_components/lists";

export default function VehiclesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CustomersNav active="vehicles" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "customers", "view")) return <NoAccess />;
  const canCreate = can(ctx, "customers", "create", false);
  const [vehicles, customers, models] = await Promise.all([
    listVehicles(),
    canCreate ? listCustomers() : Promise.resolve([]),
    canCreate ? listVehicleModels() : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        title="Kendaraan"
        description="Nomor polisi adalah kunci pencarian utama."
        actions={canCreate && <NewVehicleDialog customers={customers} models={models} />}
      />
      <VehiclesList vehicles={vehicles} />
    </>
  );
}
