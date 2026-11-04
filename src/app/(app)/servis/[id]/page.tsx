import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatDuration, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { employeeNames, getWorkOrder, listAdditionalEstimates, listCatalog, listMechanics, stockByLocation } from "@/lib/service";
import { NEXT_STATUS } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { getWorkOrderBilling } from "@/lib/cashier";
import { DepositDialog, InvoiceDialog } from "../../kasir/_components/sale-dialog";
import { AddWorkDialog, WarrantyDialog } from "../_components/dialogs";
import { EstimateActions } from "../_components/estimate-actions";
import { EstimateStatusBadge, UUID, WarrantyBadge, WoStatusBadge } from "../_components/ui";
import { StatusControls, StatusTimeline, VoidWorkOrder, WoInfoForm, WoLine } from "../_components/wo-panels";

export default function WorkOrderPage({ params }: PageProps<"/servis/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

/** timestamptz -> nilai input datetime-local (WIB) */
const toLocalInput = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .format(new Date(iso))
        .replace(" ", "T")
    : "";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "service_orders", "view") && !can(ctx, "service_board", "view")) return <NoAccess />;
  const wo = await getWorkOrder(id);
  if (!wo) notFound();

  const canUpdate = can(ctx, "service_orders", "update", false);
  const canViewAll = can(ctx, "service_orders", "view", false);
  const locked = wo.status === "delivered" || wo.status === "void";
  const isMine = wo.mechanic_ids.includes(ctx.employee.id);
  const boardAll = canUpdate || can(ctx, "service_board", "update", false);
  const next = (NEXT_STATUS[wo.status] ?? []).filter((s) => boardAll || (isMine && can(ctx, "service_board", "update") && s !== "delivered"));
  const canIssue = can(ctx, "part_issue", "update", false);
  const partItems = [...new Set(wo.lines.filter((l) => l.line_type === "part" && l.item_id).map((l) => l.item_id!))];
  const canAddWork = canUpdate && !locked && wo.status !== "waiting_approval" && !wo.is_warranty;
  const today = todayWib();

  const canBill = can(ctx, "sales", "view", false) && !wo.is_warranty;
  const canSell = can(ctx, "sales", "create", false);
  const [mechanics, names, stock, catalog, additional, billing] = await Promise.all([
    listMechanics(),
    employeeNames([...wo.logs.map((l) => l.employee_id ?? ""), ...wo.lines.flatMap((l) => l.mechanics.map((m) => m.employee_id))]),
    canIssue ? stockByLocation(partItems) : Promise.resolve([]),
    canAddWork ? listCatalog() : Promise.resolve([]),
    canViewAll ? listAdditionalEstimates(id) : Promise.resolve([]),
    canBill ? getWorkOrderBilling(id) : Promise.resolve(null),
  ]);
  const nameRecord = Object.fromEntries(names);
  const pending = additional.find((e) => e.id === wo.pending_estimate_id);

  // Klaim garansi: baris yang masih dalam masa garansi (dihitung dari tanggal invoice)
  const warrantyStart = wo.warranty_start;
  const warrantyLines =
    warrantyStart && wo.status === "delivered"
      ? wo.lines
          .filter((l) => !l.is_cancelled && l.warranty_days > 0)
          .map((l) => {
            const until = new Date(`${warrantyStart}T00:00:00Z`);
            until.setUTCDate(until.getUTCDate() + l.warranty_days);
            return { id: l.id, description: l.description, warranty_until: until.toISOString().slice(0, 10) };
          })
          .filter((l) => l.warranty_until >= today)
      : [];

  return (
    <>
      <PageHeader
        title={`${wo.plate_no} · ${wo.wo_no}`}
        description={[wo.vehicle_label, wo.customer_name, wo.customer_phone].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/servis", label: "Papan servis" }}
        actions={
          <>
            {canAddWork && <AddWorkDialog workOrderId={wo.id} vehicleId={wo.vehicle_id} catalog={catalog} today={today} />}
            {warrantyLines.length > 0 && can(ctx, "service_orders", "create", false) && <WarrantyDialog sourceId={wo.id} lines={warrantyLines} />}
          </>
        }
      />

      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <WoStatusBadge status={wo.status} />
          {wo.is_warranty && <WarrantyBadge />}
          <span className="text-muted-foreground">sejak {formatDuration(wo.minutes_in_status)} lalu</span>
          {wo.is_overdue && (
            <span className="inline-flex items-center gap-1 font-medium text-brand-red">
              <AlertTriangle className="size-4" /> Lewat estimasi waktu
            </span>
          )}
          {wo.estimated_done_at && <span className="text-muted-foreground">Estimasi selesai {formatDateTime(wo.estimated_done_at)}</span>}
        </div>
        {wo.void_reason && <p className="text-sm text-brand-red">Alasan batal: {wo.void_reason}</p>}
        {wo.status === "waiting_approval" && <p className="text-sm">Menunggu keputusan pelanggan atas pekerjaan tambahan. Status kembali berjalan setelah disetujui atau ditolak.</p>}
        {!locked && <StatusControls id={wo.id} next={next} />}
      </section>

      {billing && (
        <section className={cn(panel, "grid gap-3")}>
          <h2 className="text-lg font-semibold">Penagihan</h2>
          {billing.invoice ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Link href={`/kasir/penjualan/${billing.invoice.id}`} className="font-mono font-semibold text-brand-blue-fg hover:underline">
                {billing.invoice.sale_no}
              </Link>
              <span className="tabular-nums">Total {formatRupiah(billing.invoice.total)}</span>
              <span className={cn("font-medium tabular-nums", billing.invoice.outstanding > 0 && "text-brand-red")}>
                {billing.invoice.outstanding > 0 ? `Sisa ${formatRupiah(billing.invoice.outstanding)}` : "Lunas"}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {billing.deposit > 0 && <span className="text-sm">DP diterima <strong className="tabular-nums">{formatRupiah(billing.deposit)}</strong></span>}
              {canSell && !locked && <DepositDialog woId={wo.id} woNo={wo.wo_no} />}
              {canSell && wo.status === "ready" && <InvoiceDialog woId={wo.id} woNo={wo.wo_no} deposit={billing.deposit} />}
              {wo.status !== "ready" && <span className="text-xs text-muted-foreground">Invoice dibuat setelah WO berstatus Siap Diambil.</span>}
            </div>
          )}
        </section>
      )}

      {pending && (
        <section className={cn(panel, "grid gap-3 ring-2 ring-brand-sand")}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Pekerjaan tambahan menunggu persetujuan</h2>
            <Link href={`/servis/estimasi/${pending.id}`} className="font-mono text-sm text-brand-blue-fg hover:underline">
              {pending.estimate_no}
            </Link>
          </div>
          {pending.complaint && <p className="text-sm text-muted-foreground">{pending.complaint}</p>}
          <ul className="grid gap-1 text-sm">
            {pending.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span>
                  {l.description} × {formatQty(l.qty)}
                </span>
                <span className="tabular-nums">{formatRupiah(l.line_total)}</span>
              </li>
            ))}
          </ul>
          <p className="text-right font-semibold tabular-nums">Total tambahan {formatRupiah(pending.total)}</p>
          <EstimateActions
            id={pending.id}
            status={pending.status}
            isAdditional
            expired={false}
            waLink={null}
            canUpdate={canUpdate}
            canCreate={false}
            canVoid={can(ctx, "service_orders", "void", false)}
          />
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className={cn(panel, "grid content-start gap-2")}>
          <h2 className="text-lg font-semibold">Pekerjaan & part</h2>
          {wo.complaint && (
            <p className="text-sm">
              <span className="text-muted-foreground">Keluhan:</span> {wo.complaint}
            </p>
          )}
          <ul className="grid divide-y divide-border">
            {wo.lines.map((l) => (
              <WoLine
                key={l.id}
                line={l}
                mechanics={mechanics}
                names={nameRecord}
                stock={stock.filter((s) => s.item_id === l.item_id)}
                locked={locked}
                canAssign={canUpdate}
                canRequest={can(ctx, "part_issue", "create")}
                canIssue={canIssue}
                canCancel={canUpdate}
                showMoney={canViewAll}
              />
            ))}
          </ul>
          {canViewAll && (
            <div className="grid justify-end gap-1 border-t border-border pt-3 text-right text-sm">
              <span className="text-muted-foreground">Subtotal {formatRupiah(wo.subtotal)}</span>
              {wo.discount_amount > 0 && <span className="text-muted-foreground">Diskon -{formatRupiah(wo.discount_amount)}</span>}
              <span className="text-xl font-bold tabular-nums">{formatRupiah(wo.total)}</span>
              {wo.is_warranty && <span className="text-xs text-muted-foreground">Klaim garansi: Rp0 ke pelanggan, biaya part dicatat sebagai beban garansi.</span>}
            </div>
          )}
        </section>

        <div className="grid content-start gap-5">
          <section className={cn(panel, "grid gap-3")}>
            <h2 className="text-lg font-semibold">Data work order</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Kendaraan</dt>
              <dd>
                <Link href={`/pelanggan/kendaraan/${wo.vehicle_id}`} className="font-mono text-brand-blue-fg hover:underline">
                  {wo.plate_no}
                </Link>
              </dd>
              <dt className="text-muted-foreground">Masuk</dt>
              <dd>{formatDateTime(wo.created_at)}</dd>
              {wo.estimate_id && (
                <>
                  <dt className="text-muted-foreground">Estimasi</dt>
                  <dd>
                    {canViewAll ? (
                      <Link href={`/servis/estimasi/${wo.estimate_id}`} className="text-brand-blue-fg hover:underline">
                        Lihat estimasi
                      </Link>
                    ) : (
                      "Ada"
                    )}
                  </dd>
                </>
              )}
              {wo.warranty_source_id && (
                <>
                  <dt className="text-muted-foreground">Klaim dari</dt>
                  <dd>
                    <Link href={`/servis/${wo.warranty_source_id}`} className="text-brand-blue-fg hover:underline">
                      WO asal
                    </Link>
                  </dd>
                </>
              )}
              {wo.delivered_at && (
                <>
                  <dt className="text-muted-foreground">Diambil</dt>
                  <dd>{formatDateTime(wo.delivered_at)}</dd>
                </>
              )}
              {wo.warranty_until && (
                <>
                  <dt className="text-muted-foreground">Garansi s/d</dt>
                  <dd>{formatDate(wo.warranty_until)}</dd>
                </>
              )}
            </dl>
            {canUpdate && !locked ? (
              <WoInfoForm
                id={wo.id}
                defaults={{ estimated_done_at: toLocalInput(wo.estimated_done_at), odometer_in: wo.odometer_in != null ? String(wo.odometer_in) : "", notes: wo.notes ?? "" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {wo.odometer_in != null ? `${formatQty(wo.odometer_in)} km` : "Kilometer belum diisi"}
                {wo.notes && ` · ${wo.notes}`}
              </p>
            )}
            {!locked && can(ctx, "service_orders", "void", false) && <VoidWorkOrder id={wo.id} />}
          </section>

          {wo.issues.length > 0 && (
            <section className={cn(panel, "grid gap-2")}>
              <h2 className="text-lg font-semibold">Keluar-masuk part</h2>
              <ul className="grid gap-1.5 text-sm">
                {wo.issues.map((i) => (
                  <li key={i.id} className="flex flex-wrap justify-between gap-x-3">
                    <span>
                      {i.kind === "issue" ? "Keluar" : "Kembali"} {formatQty(i.qty)} · {wo.lines.find((l) => l.id === i.work_order_item_id)?.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {i.kind === "issue" && (i.scanned ? "scan QR · " : "manual · ")}
                      {i.location} · {formatDateTime(i.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {additional.filter((e) => e.id !== wo.pending_estimate_id).length > 0 && (
            <section className={cn(panel, "grid gap-2")}>
              <h2 className="text-lg font-semibold">Riwayat pekerjaan tambahan</h2>
              <ul className="grid gap-1.5">
                {additional
                  .filter((e) => e.id !== wo.pending_estimate_id)
                  .map((e) => (
                    <li key={e.id}>
                      <Link href={`/servis/estimasi/${e.id}`} className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
                        <span className="font-mono">{e.estimate_no}</span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{formatRupiah(e.total)}</span>
                          <EstimateStatusBadge status={e.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section className={cn(panel, "grid gap-3")}>
            <h2 className="text-lg font-semibold">Riwayat status</h2>
            <StatusTimeline logs={wo.logs.map((l) => ({ ...l, who: l.employee_id ? (names.get(l.employee_id) ?? null) : null }))} />
          </section>
        </div>
      </div>
    </>
  );
}
