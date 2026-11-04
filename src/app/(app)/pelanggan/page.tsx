import { Suspense } from "react";
import { Building2, Car, Clock, Users } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listCustomers, listVehicles } from "@/lib/customers";
import { cn } from "@/lib/utils";
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

  const activeCount = customers.filter((c) => c.is_active).length;
  const inactiveCount = customers.filter((c) => !c.is_active).length;
  const fleetCount = customers.filter((c) => c.type === "company" || c.payment_terms_days > 0 || c.credit_limit > 0).length;
  const activeVehicles = vehicles.filter((v) => v.is_active).length;
  const creditTermsCount = customers.filter((c) => c.payment_terms_days > 0).length;

  return (
    <>
      <PageHeader
        title="Pelanggan"
        description={`${activeCount} pelanggan aktif · ${activeVehicles} kendaraan terdaftar`}
        actions={can(ctx, "customers", "create", false) && <NewCustomerDialog />}
      />

      {/* Summary 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total pelanggan */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
            <Users className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total pelanggan</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{customers.length}</p>
            <p className="text-[11px] text-muted-foreground">{activeCount} aktif · {inactiveCount} nonaktif</p>
          </div>
        </section>

        {/* Pelanggan fleet */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
            <Building2 className="size-5 text-brand-green" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Pelanggan fleet</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{fleetCount}</p>
            <p className="text-[11px] text-muted-foreground">perusahaan / boleh tempo</p>
          </div>
        </section>

        {/* Kendaraan terdaftar */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
            <Car className="size-5 text-brand-sand" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Kendaraan terdaftar</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{vehicles.length}</p>
            <p className="text-[11px] text-muted-foreground">{activeVehicles} kendaraan aktif</p>
          </div>
        </section>

        {/* Tempo pembayaran */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
            <Clock className="size-5 text-brand-red" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Boleh tempo</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{creditTermsCount}</p>
            <p className="text-[11px] text-muted-foreground">pelanggan bertempo</p>
          </div>
        </section>
      </div>

      <CustomersList customers={customers} vehicles={vehicles} />
    </>
  );
}
