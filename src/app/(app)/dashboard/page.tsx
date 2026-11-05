import { Suspense } from "react";
import { can, requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard";
import { listCatalog, listVehicleOptions } from "@/lib/service";
import { listCustomers, listVehicleModels } from "@/lib/customers";
import { DashboardSkeleton, DashboardView } from "./view";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const ctx = await requireUser();
  const [data, vehicles, catalog, customers, models] = await Promise.all([
    loadDashboard(ctx),
    can(ctx, "service_orders", "create") ? listVehicleOptions() : Promise.resolve([]),
    can(ctx, "service_orders", "create") || can(ctx, "sales", "create") ? listCatalog() : Promise.resolve([]),
    can(ctx, "sales", "create") || can(ctx, "customers", "create") ? listCustomers() : Promise.resolve([]),
    can(ctx, "customers", "create") ? listVehicleModels() : Promise.resolve([]),
  ]);
  const customerOptions = customers
    .filter((c) => c.is_active)
    .map((c) => ({ id: c.id, name: c.name, phone: c.phone, is_active: c.is_active }));

  return (
    <DashboardView
      ctx={ctx}
      data={data}
      vehicles={vehicles}
      catalog={catalog}
      customers={customerOptions}
      models={models}
    />
  );
}
