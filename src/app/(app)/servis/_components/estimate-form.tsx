"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CancelButton } from "@/components/cancel-button";
import { FormError, FormField } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import type { CatalogOption, VehicleOption } from "@/lib/service";
import { toNumber } from "@/lib/validation/common";
import { CHANNELS, CHANNEL_LABEL, estimateSchema, type EstimateInput } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { addWorkAction, saveEstimateAction } from "../actions";
import { CatalogPicker, TypeTag, VehiclePicker } from "./pickers";

export type EstimateFormResult = { href?: string; message: string; warning?: string };

/**
 * Form estimasi. mode:
 *  - "new"        estimasi baru (pilih kendaraan lewat plat)
 *  - "revise"     revisi estimasi (versi baru jika sudah dikirim/diputuskan)
 *  - "additional" pekerjaan tambahan di tengah WO (wajib persetujuan pelanggan)
 */
export function EstimateForm({
  mode,
  estimateId,
  workOrderId,
  defaults,
  vehicles,
  catalog,
  onDone,
  onCancel,
}: {
  mode: "new" | "revise" | "additional";
  estimateId?: string;
  workOrderId?: string;
  defaults: EstimateInput;
  vehicles: VehicleOption[];
  catalog: CatalogOption[];
  onDone: (r: EstimateFormResult) => void;
  onCancel?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, setValue, formState } = useForm<EstimateInput>({ resolver: zodResolver(estimateSchema), defaultValues: defaults });
  const lines = useFieldArray({ control, name: "lines" });
  const watched = useWatch({ control, name: "lines" }) ?? [];
  const vehicleId = useWatch({ control, name: "vehicle_id" });
  const approved = useWatch({ control, name: "approved" });
  const discount = toNumber(useWatch({ control, name: "discount_amount" }));
  const errors = formState.errors;
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const lineTotal = (idx: number) => {
    const l = watched[idx];
    const c = l && byKey.get(`${l.type}:${l.ref_id}`);
    if (!c) return 0;
    return Math.max(toNumber(l.qty) * c.price - (l.type === "package" ? 0 : toNumber(l.discount_amount)), 0);
  };
  const subtotal = watched.reduce((t, _, i) => t + lineTotal(i), 0);

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      if (mode === "additional") {
        const r = await addWorkAction(workOrderId!, values);
        if (!r.ok) return setError(r.error);
        return onDone({ message: values.approved ? "Pekerjaan tambahan masuk ke work order." : "Pekerjaan tambahan menunggu persetujuan pelanggan." });
      }
      const r = await saveEstimateAction(mode === "revise" ? estimateId! : null, values);
      if (!r.ok) return setError(r.error);
      if (r.data.workOrderId) return onDone({ href: `/servis/${r.data.workOrderId}`, message: "Disetujui dan work order dibuat." });
      onDone({
        href: `/servis/estimasi/${r.data.id}`,
        message: r.data.warning ? "Estimasi tersimpan." : values.approved ? "Estimasi disetujui." : "Estimasi tersimpan.",
        warning: r.data.warning,
      });
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {mode !== "additional" && (
        <section className={cn(panel, "grid gap-4")}>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Kendaraan *</span>
            {vehicle ? (
              <div className="grid gap-2 rounded-sm border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-semibold">{vehicle.plate_no}</p>
                    <p className="text-sm text-muted-foreground">{[vehicle.label, vehicle.customer_name].filter(Boolean).join(" · ") || "Tanpa keterangan"}</p>
                  </div>
                  {mode === "new" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setValue("vehicle_id", "")}>
                      Ganti
                    </Button>
                  )}
                </div>
                {vehicle.last_service ? (
                  <p className="flex gap-2 rounded-sm bg-muted/60 p-2 text-xs text-muted-foreground">
                    <History className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      Servis terakhir {formatDate(vehicle.last_service.date)} ({vehicle.last_service.wo_no}): {vehicle.last_service.services || "tanpa jasa"}
                      {vehicle.last_service.parts && `; part: ${vehicle.last_service.parts}`}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Belum pernah servis di sini.</p>
                )}
              </div>
            ) : (
              <VehiclePicker options={vehicles} onPick={(v) => setValue("vehicle_id", v.id, { shouldValidate: true })} />
            )}
            {errors.vehicle_id?.message && <p className="text-xs text-destructive">{errors.vehicle_id.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="odometer"
              label="Kilometer saat ini"
              inputMode="numeric"
              placeholder={vehicle?.last_odometer != null ? `terakhir ${formatQty(vehicle.last_odometer)}` : ""}
              error={errors.odometer?.message}
              {...register("odometer")}
            />
            <FormField id="valid_until" label="Berlaku sampai" type="date" error={errors.valid_until?.message} {...register("valid_until")} />
          </div>
        </section>
      )}

      <section className={cn(panel, "grid gap-3")}>
        <div className="grid gap-1.5">
          <label htmlFor="complaint" className="text-sm font-medium">
            {mode === "additional" ? "Temuan / alasan pekerjaan tambahan" : "Keluhan pelanggan"}
          </label>
          <textarea id="complaint" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("complaint")} />
        </div>
        <h2 className="pt-1 text-lg font-semibold">Jasa & part</h2>
        <CatalogPicker
          options={catalog}
          onPick={(c) => {
            const exists = watched.findIndex((l) => l.type === c.type && l.ref_id === c.id);
            if (exists >= 0 && c.type !== "service") setValue(`lines.${exists}.qty`, String(toNumber(watched[exists].qty) + 1));
            else lines.append({ type: c.type, ref_id: c.id, qty: "1", discount_amount: "" });
          }}
        />
        {errors.lines?.message && <p className="text-xs text-destructive">{errors.lines.message}</p>}
        <ul className="grid gap-2">
          {lines.fields.map((f, idx) => {
            const c = byKey.get(`${f.type}:${f.ref_id}`);
            return (
              <li key={f.id} className="grid gap-2 rounded-sm border border-border p-3 sm:grid-cols-[minmax(0,1.6fr)_90px_130px_130px_auto] sm:items-end">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <TypeTag type={f.type} />
                    <span className="truncate">{c?.name ?? "Tidak aktif"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRupiah(c?.price)}
                    {f.type === "part" && c && ` / ${c.unit} · stok ${formatQty(c.stock)}`}
                    {f.type === "package" && " · dipecah per komponen, harga khusus paket"}
                  </p>
                </div>
                <FormField id={`lines.${idx}.qty`} label="Jumlah" inputMode="decimal" error={errors.lines?.[idx]?.qty?.message} {...register(`lines.${idx}.qty`)} />
                {f.type === "package" ? (
                  <span className="hidden sm:block" />
                ) : (
                  <FormField
                    id={`lines.${idx}.discount_amount`}
                    label="Diskon (Rp)"
                    inputMode="numeric"
                    error={errors.lines?.[idx]?.discount_amount?.message}
                    {...register(`lines.${idx}.discount_amount`)}
                  />
                )}
                <p className="text-sm font-semibold tabular-nums sm:pb-2.5 sm:text-right">{formatRupiah(lineTotal(idx))}</p>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => lines.remove(idx)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_200px] sm:items-end">
          <div className="grid gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium">
              Catatan
            </label>
            <input id="notes" className={inputClass} {...register("notes")} />
          </div>
          <FormField id="discount_amount" label="Diskon total (Rp)" inputMode="numeric" error={errors.discount_amount?.message} {...register("discount_amount")} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
          <span className="text-muted-foreground">Subtotal {formatRupiah(subtotal)}</span>
          <span className="flex items-baseline gap-2">
            <span className="text-muted-foreground">Total</span>
            <span className="text-xl font-bold tabular-nums">{formatRupiah(Math.max(subtotal - discount, 0))}</span>
          </span>
        </div>
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-brand-blue-ink" {...register("approved")} />
          Pelanggan sudah menyetujui {mode === "additional" ? "pekerjaan tambahan ini" : "estimasi ini"}
        </label>
        {approved ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cara persetujuan">
              {CHANNELS.map((ch) => (
                <label key={ch} className="flex cursor-pointer items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm has-checked:border-brand-blue-ink has-checked:bg-brand-blue-soft">
                  <input type="radio" value={ch} className="accent-brand-blue-ink" {...register("approval_channel")} />
                  {CHANNEL_LABEL[ch]}
                </label>
              ))}
            </div>
            {errors.approval_channel?.message && <p className="text-xs text-destructive">{errors.approval_channel.message}</p>}
            <input placeholder="Catatan persetujuan (opsional), mis. disetujui Pak Budi jam 10.15" aria-label="Catatan persetujuan" className={inputClass} {...register("approval_note")} />
            {mode !== "additional" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand-blue-ink" {...register("make_work_order")} />
                Langsung buat work order
              </label>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {mode === "additional"
              ? "Tanpa persetujuan, WO berstatus Menunggu Persetujuan sampai pelanggan memutuskan."
              : "Simpan dulu, kirim ke pelanggan lewat WhatsApp, lalu catat persetujuannya dari halaman estimasi."}
          </p>
        )}
      </section>

      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : mode === "additional" ? "Simpan pekerjaan tambahan" : mode === "revise" ? "Simpan revisi" : "Simpan estimasi"}
        </Button>
        <CancelButton href="/servis/estimasi" onCancel={onCancel}>
          Kembali
        </CancelButton>
      </div>
    </form>
  );
}

export const emptyEstimate = (validUntil: string, vehicleId = ""): EstimateInput => ({
  vehicle_id: vehicleId,
  odometer: "",
  complaint: "",
  valid_until: validUntil,
  discount_amount: "",
  notes: "",
  lines: [],
  approved: false,
  approval_channel: "",
  approval_note: "",
  make_work_order: true,
});
