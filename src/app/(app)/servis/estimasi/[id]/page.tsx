import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { getEstimate, listCatalog, listVehicleOptions, type EstimateDetail } from "@/lib/service";
import { CHANNEL_LABEL, type EstimateInput } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { ReviseEstimateDialog } from "../../_components/dialogs";
import { EstimateActions } from "../../_components/estimate-actions";
import { TypeTag } from "../../_components/pickers";
import { EstimateStatusBadge, UUID } from "../../_components/ui";

export default function EstimateDetailPage({ params }: PageProps<"/servis/estimasi/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

/** Pesan WhatsApp klik-ke-chat berisi ringkasan estimasi (PRD §7.1) */
function waLink(e: EstimateDetail) {
  if (!e.customer_phone) return null;
  const lines = e.lines.map((l) => `- ${l.description}${l.qty !== 1 ? ` x${formatQty(l.qty)}` : ""}: ${formatRupiah(l.line_total)}`);
  const text = [
    `Halo ${e.customer_name ?? ""}, berikut estimasi servis ${e.plate_no} (${e.estimate_no}${e.version > 1 ? ` rev ${e.version}` : ""}):`,
    ...lines,
    e.discount_amount > 0 ? `Diskon: -${formatRupiah(e.discount_amount)}` : "",
    `Total: ${formatRupiah(e.total)}`,
    `Berlaku sampai ${formatDate(e.valid_until)}. Mohon balas SETUJU jika berkenan.`,
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/62${e.customer_phone.replace(/^0/, "")}?text=${encodeURIComponent(text)}`;
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "service_orders", "view", false)) return <NoAccess />;
  const e = await getEstimate(id);
  if (!e) notFound();
  const canUpdate = can(ctx, "service_orders", "update", false);
  const revisable = canUpdate && !e.is_additional && ["draft", "sent", "rejected", "approved"].includes(e.status);
  const [vehicles, catalog] = revisable ? await Promise.all([listVehicleOptions(), listCatalog()]) : [[], []];
  const expired = e.valid_until < todayWib();

  // Baris paket dikembalikan jadi satu baris paket (jumlah = nilai / harga paket saat ini)
  const pkgPrice = new Map(catalog.filter((c) => c.type === "package").map((c) => [c.id, c.price]));
  const pkgTotals = new Map<string, number>();
  for (const l of e.lines) if (l.package_id) pkgTotals.set(l.package_id, (pkgTotals.get(l.package_id) ?? 0) + l.line_total);
  const defaults: EstimateInput = {
    vehicle_id: e.vehicle_id,
    odometer: e.odometer != null ? String(e.odometer) : "",
    complaint: e.complaint ?? "",
    valid_until: expired ? todayWib() : e.valid_until,
    discount_amount: e.discount_amount ? String(e.discount_amount) : "",
    notes: e.notes ?? "",
    lines: [
      ...e.lines
        .filter((l) => !l.package_id)
        .map((l) => ({ type: l.line_type, ref_id: (l.service_id ?? l.item_id)!, qty: String(l.qty), discount_amount: l.discount_amount ? String(l.discount_amount) : "" })),
      ...[...pkgTotals].map(([pid, total]) => ({
        type: "package" as const,
        ref_id: pid,
        qty: String(Math.max(1, Math.round(total / (pkgPrice.get(pid) || total || 1)))),
        discount_amount: "",
      })),
    ],
    approved: false,
    approval_channel: "",
    approval_note: "",
    make_work_order: true,
  };

  return (
    <>
      <PageHeader
        title={`${e.estimate_no}${e.version > 1 ? ` rev ${e.version}` : ""}`}
        description={`${e.plate_no}${e.customer_name ? ` · ${e.customer_name}` : ""} · ${formatDate(e.created_at)}`}
        back={{ href: e.is_additional && e.work_order_id ? `/servis/${e.work_order_id}` : "/servis/estimasi", label: e.is_additional ? "Work order" : "Estimasi" }}
        actions={
          revisable && <ReviseEstimateDialog estimateId={e.id} defaults={defaults} vehicles={vehicles} catalog={catalog} versioned={e.status !== "draft"} />
        }
      />
      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <EstimateStatusBadge status={e.status} />
          {e.is_additional && <span className="rounded-sm bg-brand-sand-soft px-2 py-0.5 text-xs font-medium">Pekerjaan tambahan</span>}
          <span className="text-muted-foreground">Berlaku s/d {formatDate(e.valid_until)}</span>
          {e.odometer != null && <span className="text-muted-foreground">{formatQty(e.odometer)} km</span>}
          {e.sent_at && <span className="text-muted-foreground">Dikirim {formatDateTime(e.sent_at)}</span>}
        </div>
        {e.decided_at && (
          <p className="text-sm">
            {e.status === "rejected" ? "Ditolak" : "Disetujui"} {formatDateTime(e.decided_at)}
            {e.approval_channel && ` · ${CHANNEL_LABEL[e.approval_channel]}`}
            {e.approval_note && ` · ${e.approval_note}`}
          </p>
        )}
        {e.void_reason && <p className="text-sm text-brand-red">Alasan batal: {e.void_reason}</p>}
        {e.work_order_id && e.wo_no && (
          <Link href={`/servis/${e.work_order_id}`} className="text-sm font-medium text-brand-blue-fg hover:underline">
            Buka work order {e.wo_no} →
          </Link>
        )}
        <EstimateActions
          id={e.id}
          status={e.status}
          isAdditional={e.is_additional}
          expired={expired}
          waLink={waLink(e)}
          canUpdate={canUpdate}
          canCreate={can(ctx, "service_orders", "create", false)}
          canVoid={can(ctx, "service_orders", "void", false)}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className={cn(panel, "grid content-start gap-3")}>
          {e.complaint && (
            <p className="text-sm">
              <span className="text-muted-foreground">Keluhan:</span> {e.complaint}
            </p>
          )}
          <ul className="grid divide-y divide-border">
            {e.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <TypeTag type={l.line_type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.description}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatQty(l.qty)} × {formatRupiah(l.unit_price)}
                    {l.discount_amount > 0 && ` · diskon ${formatRupiah(l.discount_amount)}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatRupiah(l.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="grid justify-end gap-1 border-t border-border pt-3 text-right text-sm">
            <span className="text-muted-foreground">Subtotal {formatRupiah(e.subtotal)}</span>
            {e.discount_amount > 0 && <span className="text-muted-foreground">Diskon -{formatRupiah(e.discount_amount)}</span>}
            <span className="text-xl font-bold tabular-nums">{formatRupiah(e.total)}</span>
          </div>
          {e.notes && <p className="text-sm text-muted-foreground">Catatan: {e.notes}</p>}
        </section>
        <section className={cn(panel, "grid content-start gap-2")}>
          <h2 className="font-semibold">Versi</h2>
          <ol className="grid gap-1.5">
            {e.versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/servis/estimasi/${v.id}`}
                  aria-current={v.id === e.id ? "page" : undefined}
                  className={cn("flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted", v.id === e.id && "bg-muted font-medium")}
                >
                  <span>Versi {v.version}</span>
                  <EstimateStatusBadge status={v.status} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
