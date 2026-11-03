import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listCustomers, listVehicles } from "@/lib/customers";
import { NewCustomerDialog } from "./_components/dialogs";
import { CustomersList, CustomersNav } from "./_components/lists";

export default function CustomersPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CustomersNav active="customers" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "customers", "view")) return <NoAccess />;
  const [customers, vehicles] = await Promise.all([listCustomers(), listVehicles()]);
  return (
    <>
      <PageHeader
        title="Pelanggan"
        description={`${customers.filter((c) => c.is_active).length} pelanggan · ${vehicles.filter((v) => v.is_active).length} kendaraan`}
        actions={can(ctx, "customers", "create", false) && <NewCustomerDialog />}
      />
      <CustomersList customers={customers} vehicles={vehicles} />
    </>
  );
}
