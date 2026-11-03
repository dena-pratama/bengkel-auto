import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getCustomer, listCustomers, listOwnerships, listVehicleModels, listVehicles } from "@/lib/customers";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import { CUSTOMER_TYPE_LABEL } from "@/lib/validation/customer";
import { cn } from "@/lib/utils";
import { NewVehicleDialog } from "../_components/dialogs";
import { CustomerForm } from "../_components/forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CustomerDetailPage({ params }: PageProps<"/pelanggan/[id]">) {
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
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const canCreate = can(ctx, "customers", "create", false);
  const [vehicles, ownerships, customers, models] = await Promise.all([
    listVehicles(),
    listOwnerships({ customerId: id }),
    canCreate ? listCustomers() : Promise.resolve([]),
    canCreate ? listVehicleModels() : Promise.resolve([]),
  ]);
  const owned = vehicles.filter((v) => v.customer_id === id);
  const past = ownerships.filter((o) => o.ended_at);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`${customer.code} · ${CUSTOMER_TYPE_LABEL[customer.type]}${customer.is_active ? "" : " · Nonaktif"}`}
        back={{ href: "/pelanggan", label: "Pelanggan" }}
      />
      {/* Ringkasan transaksi: terisi setelah modul Kasir & Servis */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total belanja", value: formatRupiah(0) },
          { label: "Piutang berjalan", value: formatRupiah(0) },
          { label: "Kendaraan", value: `${owned.length} unit` },
        ].map((s) => (
          <section key={s.label} className={cn(panel, "grid gap-1 p-4")}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
          </section>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <CustomerForm
          key={customer.id}
          id={customer.id}
          readOnly={!can(ctx, "customers", "update", false)}
          isActive={customer.is_active}
          defaults={{
            type: customer.type,
            name: customer.name,
            phone: customer.phone ?? "",
            email: customer.email ?? "",
            address: customer.address ?? "",
            npwp: customer.npwp ?? "",
            credit_limit: String(customer.credit_limit),
            payment_terms_days: String(customer.payment_terms_days),
            notes: customer.notes ?? "",
          }}
        />
        <div className="grid content-start gap-4">
          <section className={cn(panel, "grid gap-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Kendaraan</h2>
              {canCreate && <NewVehicleDialog customers={customers} models={models} fixedOwner={{ id: customer.id, name: customer.name }} variant="outline" />}
            </div>
            {owned.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada kendaraan.</p>
            ) : (
              <ul className="grid gap-2">
                {owned.map((v) => (
                  <li key={v.id}>
                    <Link href={`/pelanggan/kendaraan/${v.id}`} className="flex items-center gap-3 rounded-sm border border-border p-3 hover:bg-muted/60">
                      <span className="shrink-0 rounded-sm border-2 border-foreground/80 px-2 py-1 font-mono text-sm font-bold">{v.plate_no}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {[v.make_name, v.model_name, v.year].filter(Boolean).join(" ") || "Model belum diisi"}
                        {v.last_odometer != null && <span className="text-muted-foreground"> · {formatQty(v.last_odometer)} km</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {past.length > 0 && (
              <div className="grid gap-1 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Pernah dimiliki</p>
                {past.map((o) => (
                  <p key={o.id} className="text-sm">
                    <span className="font-mono">{o.plate_no}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatDate(o.started_at)} s/d {formatDate(o.ended_at)}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </section>
          <section className={cn(panel, "grid gap-2")}>
            <h2 className="text-lg font-semibold">Transaksi terakhir</h2>
            <p className="text-sm text-muted-foreground">Riwayat servis & belanja tampil di sini setelah modul Servis dan Kasir aktif.</p>
          </section>
        </div>
      </div>
    </>
  );
}
