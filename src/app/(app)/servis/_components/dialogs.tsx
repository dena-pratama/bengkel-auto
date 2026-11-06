"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TOAST_MS } from "@/components/app-toaster";
import { FilePen, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { formatDate } from "@/lib/format";
import type { CatalogOption, VehicleOption } from "@/lib/service";
import type { EstimateInput } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { createWarrantyAction } from "../actions";
import { EstimateForm, emptyEstimate, type EstimateFormResult } from "./estimate-form";

/** Setelah simpan: tutup, toast, lalu buka detail (atau segarkan halaman ini) */
function useFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onDone = (r: EstimateFormResult) => {
    setOpen(false);
    if (r.warning) toast.warning(r.warning, { duration: TOAST_MS.warning });
    else toast.success(r.message);
    if (r.href) router.push(r.href);
    else router.refresh();
  };
  return { open, setOpen, onDone, onCancel: () => setOpen(false) };
}

export function NewEstimateDialog({
  vehicles,
  catalog,
  validUntil,
  vehicleId,
  label = "Estimasi baru",
  variant = "default",
  trigger,
}: {
  vehicles: VehicleOption[];
  catalog: CatalogOption[];
  validUntil: string;
  vehicleId?: string;
  label?: string;
  variant?: "default" | "outline";
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const d = useFormDialog();
  return (
    <>
      {trigger ? (
        trigger(() => d.setOpen(true))
      ) : (
        <Button variant={variant} onClick={() => d.setOpen(true)}>
          <Plus className="size-4" /> {label}
        </Button>
      )}
      <FormDialog
        open={d.open}
        onOpenChange={d.setOpen}
        title="Estimasi baru"
        description="Tidak ada pekerjaan tanpa estimasi yang disetujui pelanggan. Jika sudah setuju, bisa langsung jadi work order."
        size="xl"
      >
        <EstimateForm mode="new" defaults={emptyEstimate(validUntil, vehicleId)} vehicles={vehicles} catalog={catalog} onDone={d.onDone} onCancel={d.onCancel} />
      </FormDialog>
    </>
  );
}

export function ReviseEstimateDialog({
  estimateId,
  defaults,
  vehicles,
  catalog,
  versioned,
}: {
  estimateId: string;
  defaults: EstimateInput;
  vehicles: VehicleOption[];
  catalog: CatalogOption[];
  versioned: boolean;
}) {
  const d = useFormDialog();
  return (
    <>
      <Button variant="outline" onClick={() => d.setOpen(true)}>
        <FilePen className="size-4" /> {versioned ? "Revisi" : "Ubah"}
      </Button>
      <FormDialog
        open={d.open}
        onOpenChange={d.setOpen}
        title={versioned ? "Revisi estimasi" : "Ubah estimasi"}
        description={versioned ? "Revisi disimpan sebagai versi baru; versi sebelumnya tetap tersimpan." : undefined}
        size="xl"
      >
        <EstimateForm mode="revise" estimateId={estimateId} defaults={defaults} vehicles={vehicles} catalog={catalog} onDone={d.onDone} onCancel={d.onCancel} />
      </FormDialog>
    </>
  );
}

export function AddWorkDialog({ workOrderId, vehicleId, catalog, today }: { workOrderId: string; vehicleId: string; catalog: CatalogOption[]; today: string }) {
  const d = useFormDialog();
  return (
    <>
      <Button variant="outline" onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Pekerjaan tambahan
      </Button>
      <FormDialog
        open={d.open}
        onOpenChange={d.setOpen}
        title="Pekerjaan tambahan"
        description="Tercatat sebagai estimasi tambahan dan wajib disetujui pelanggan sebelum dikerjakan."
        size="xl"
      >
        <EstimateForm mode="additional" workOrderId={workOrderId} defaults={emptyEstimate(today, vehicleId)} vehicles={[]} catalog={catalog} onDone={d.onDone} onCancel={d.onCancel} />
      </FormDialog>
    </>
  );
}

export type WarrantyLine = { id: string; description: string; warranty_until: string };

/** Klaim garansi dari riwayat servis: WO baru bertanda Garansi, Rp0 ke pelanggan */
export function WarrantyDialog({ sourceId, lines }: { sourceId: string; lines: WarrantyLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [complaint, setComplaint] = useState("");
  const [odometer, setOdometer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await createWarrantyAction(sourceId, { complaint, odometer, item_ids: picked });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      toast.success("WO klaim garansi dibuat.");
      router.push(`/servis/${r.data.id}`);
    });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ShieldCheck className="size-4" /> Klaim garansi
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Klaim garansi" description="Biaya part & jasa klaim tercatat sebagai beban garansi, bukan ditagih ke pelanggan." size="md">
        <div className="grid gap-4">
          <section className={cn(panel, "grid gap-2")}>
            <p className="text-sm font-medium">Jasa / part yang diklaim</p>
            {lines.map((l) => (
              <label key={l.id} className="flex items-center gap-2 rounded-sm border border-border p-2 text-sm has-checked:border-brand-blue-ink has-checked:bg-brand-blue-soft">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-blue-ink"
                  checked={picked.includes(l.id)}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, l.id] : p.filter((x) => x !== l.id)))}
                />
                <span className="min-w-0 flex-1 truncate">{l.description}</span>
                <span className="shrink-0 text-xs text-muted-foreground">s/d {formatDate(l.warranty_until)}</span>
              </label>
            ))}
          </section>
          <section className={cn(panel, "grid gap-3")}>
            <label className="grid gap-1.5 text-sm font-medium">
              Keluhan *
              <textarea rows={2} value={complaint} onChange={(e) => setComplaint(e.target.value)} className={cn(inputClass, "h-auto py-2")} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Kilometer saat ini
              <input inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} className={inputClass} />
            </label>
          </section>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={pending}>
              {pending ? "Menyimpan..." : "Buat WO garansi"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}
