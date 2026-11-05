"use server";

import { can, requireUser } from "@/lib/auth";
import { listCatalog, listVehicleOptions, type CatalogOption, type VehicleOption } from "@/lib/service";
import { listCustomers, listVehicleModels, type Customer } from "@/lib/customers";

export type QuickActionData = {
  vehicles: VehicleOption[];
  catalog: CatalogOption[];
  customers: Pick<Customer, "id" | "name" | "phone" | "is_active">[];
  models: { make: string; model: string }[];
};

export async function loadQuickActionDataAction(): Promise<QuickActionData> {
  const ctx = await requireUser();
  const [vehicles, catalog, customers, models] = await Promise.all([
    can(ctx, "service_orders", "create") ? listVehicleOptions() : Promise.resolve([]),
    can(ctx, "service_orders", "create") || can(ctx, "sales", "create") ? listCatalog() : Promise.resolve([]),
    can(ctx, "sales", "create") || can(ctx, "customers", "create") ? listCustomers() : Promise.resolve([]),
    can(ctx, "customers", "create") ? listVehicleModels() : Promise.resolve([]),
  ]);
  const customerOptions = customers
    .filter((c) => c.is_active)
    .map((c) => ({ id: c.id, name: c.name, phone: c.phone, is_active: c.is_active }));

  return { vehicles, catalog, customers: customerOptions, models };
}
