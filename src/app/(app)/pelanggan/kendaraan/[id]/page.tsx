import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getVehicle, listCustomers, listOwnerships, listVehicleModels } from "@/lib/customers";
import { addDays, formatDate, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { listCatalog, listVehicleOptions, listVehicleWorkOrders } from "@/lib/service";
import { cn } from "@/lib/utils";
import { NewEstimateDialog } from "../../../servis/_components/dialogs";
import { WarrantyBadge, WoStatusBadge } from "../../../servis/_components/ui";
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
  const canSeeService = can(ctx, "service_orders", "view");
  const canEstimate = can(ctx, "service_orders", "create", false) && vehicle.is_active;
  const showMoney = can(ctx, "service_orders", "view", false);
  const [ownerships, customers, models, history, estimateOptions] = await Promise.all([
    listOwnerships({ vehicleId: id }),
    canUpdate ? listCustomers() : Promise.resolve([]),
    canUpdate ? listVehicleModels() : Promise.resolve([]),
    canSeeService ? listVehicleWorkOrders(id) : Promise.resolve([]),
    canEstimate ? Promise.all([listVehicleOptions(), listCatalog()]) : Promise.resolve(null),
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
          <section className={cn(panel, "grid gap-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Riwayat servis</h2>
              {estimateOptions && (
                <NewEstimateDialog
                  vehicles={estimateOptions[0]}
                  catalog={estimateOptions[1]}
                  validUntil={addDays(todayWib(), 7)}
                  vehicleId={vehicle.id}
                  label="Estimasi servis"
                  variant="outline"
                />
              )}
            </div>
            {!canSeeService ? (
              <p className="text-sm text-muted-foreground">Anda tidak punya akses ke data servis.</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada servis untuk kendaraan ini.</p>
            ) : (
              <ul className="grid divide-y divide-border">
                {history.map((w) => (
                  <li key={w.id}>
                    <Link href={`/servis/${w.id}`} className="grid gap-1 py-2.5 hover:bg-muted/40">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{formatDate(w.delivered_at ?? w.created_at)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{w.wo_no}</span>
                        {w.odometer_in != null && <span className="text-xs text-muted-foreground">{formatQty(w.odometer_in)} km</span>}
                        <span className="flex-1" />
                        {w.is_warranty && <WarrantyBadge />}
                        <WoStatusBadge status={w.status} />
                      </span>
                      {w.services && <span className="text-sm">Jasa: {w.services}</span>}
                      {w.parts && <span className="text-sm">Part: {w.parts}</span>}
                      <span className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                        <span>
                          {w.mechanics ? `Mekanik: ${w.mechanics}` : "Mekanik belum diisi"}
                          {w.warranty_until && ` · garansi s/d ${formatDate(w.warranty_until)}`}
                        </span>
                        {showMoney && <span className="font-semibold text-foreground tabular-nums">{formatRupiah(w.total)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
