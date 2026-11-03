import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getVehicle, listCustomers, listOwnerships, listVehicleModels } from "@/lib/customers";
import { formatDate, todayWib } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TransferForm, VehicleForm } from "../../_components/forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function VehicleDetailPage({ params }: PageProps<"/pelanggan/kendaraan/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "customers", "view")) return <NoAccess />;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();
  const canUpdate = can(ctx, "customers", "update", false);
  const [ownerships, customers, models] = await Promise.all([
    listOwnerships({ vehicleId: id }),
    canUpdate ? listCustomers() : Promise.resolve([]),
    canUpdate ? listVehicleModels() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={vehicle.plate_no}
        description={[vehicle.make_name, vehicle.model_name, vehicle.variant, vehicle.year].filter(Boolean).join(" ") || "Model belum diisi"}
        back={{ href: "/pelanggan/kendaraan", label: "Kendaraan" }}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <VehicleForm
          key={vehicle.id}
          id={vehicle.id}
          customers={customers}
          models={models}
          readOnly={!canUpdate}
          isActive={vehicle.is_active}
          defaults={{
            plate_no: vehicle.plate_no,
            make: vehicle.make_name ?? "",
            model: vehicle.model_name ?? "",
            variant: vehicle.variant ?? "",
            year: vehicle.year != null ? String(vehicle.year) : "",
            color: vehicle.color ?? "",
            transmission: vehicle.transmission ?? "",
            fuel: vehicle.fuel ?? "",
            vin: vehicle.vin ?? "",
            engine_no: vehicle.engine_no ?? "",
            last_odometer: vehicle.last_odometer != null ? String(vehicle.last_odometer) : "",
            notes: vehicle.notes ?? "",
            owner_id: "",
          }}
        />
        <div className="grid content-start gap-4">
          <section className={cn(panel, "grid gap-3")}>
            <h2 className="text-lg font-semibold">Pemilik</h2>
            {vehicle.customer_id ? (
              <Link href={`/pelanggan/${vehicle.customer_id}`} className="rounded-sm border border-border p-3 hover:bg-muted/60">
                <p className="font-medium">{vehicle.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.customer_phone ?? "Tanpa nomor HP"} · sejak {formatDate(vehicle.owned_since)}
                </p>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada pemilik.</p>
            )}
            {canUpdate && <TransferForm vehicleId={vehicle.id} currentOwnerId={vehicle.customer_id} customers={customers} today={todayWib()} />}
            <ol className="grid gap-2 border-l-2 border-border pl-4">
              {ownerships.map((o) => (
                <li key={o.id} className="relative text-sm">
                  <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card", o.ended_at ? "bg-muted-foreground" : "bg-brand-blue")} />
                  <p className="font-medium">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(o.started_at)} s/d {o.ended_at ? formatDate(o.ended_at) : "sekarang"}
                    {o.note && ` · ${o.note}`}
                  </p>
                </li>
              ))}
            </ol>
          </section>
          <section className={cn(panel, "grid gap-2")}>
            <h2 className="text-lg font-semibold">Riwayat servis</h2>
            <p className="text-sm text-muted-foreground">Tanggal, kilometer, jasa, part, mekanik, dan biaya tampil di sini setelah modul Servis aktif.</p>
          </section>
        </div>
      </div>
    </>
  );
}
