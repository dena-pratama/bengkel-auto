"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError, FormField } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import type { ServiceCategory } from "@/lib/inventory";
import { serviceSchema, type ServiceInput } from "@/lib/validation/inventory";
import { cn } from "@/lib/utils";
import { saveServiceAction, setActiveAction } from "../actions";

export function ServiceForm({
  id,
  defaults,
  categories,
  canSetPrice,
  readOnly,
  isActive,
}: {
  id: string | null;
  defaults: ServiceInput;
  categories: ServiceCategory[];
  canSetPrice: boolean;
  readOnly: boolean;
  isActive: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, formState, reset } = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: defaults,
  });
  const commissionType = useWatch({ control, name: "commission_type" });
  const errors = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveServiceAction(id, values);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (!id) return router.push(`/inventory/jasa/${result.data.id}`);
      reset(values);
      setMessage({ ok: true, text: "Jasa tersimpan." });
      router.refresh();
    });
  });

  const toggleActive = () =>
    startTransition(async () => {
      if (!id) return;
      const result = await setActiveAction("services", id, !isActive);
      setMessage(result.ok ? { ok: true, text: isActive ? "Jasa dinonaktifkan." : "Jasa diaktifkan." } : { ok: false, text: result.error });
      router.refresh();
    });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset disabled={readOnly || pending} className={cn(panel, "grid gap-4 sm:grid-cols-2")}>
        <div className="sm:col-span-2">
          <FormField id="name" label="Nama jasa *" placeholder="mis. Tune Up Mesin Bensin" error={errors.name?.message} {...register("name")} />
        </div>
        <FormField id="code" label="Kode" placeholder="Kosongkan = otomatis (JS-001)" className="uppercase" error={errors.code?.message} {...register("code")} />
        <div className="grid gap-1.5">
          <label htmlFor="category_id" className="text-sm font-medium">
            Kategori jasa
          </label>
          <select id="category_id" className={inputClass} {...register("category_id")}>
            <option value="">— Tanpa kategori —</option>
            {categories
              .filter((c) => c.is_active || c.id === defaults.category_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <FormField
            id="price"
            label="Harga jasa (Rp)"
            inputMode="numeric"
            readOnly={!canSetPrice}
            className={cn(!canSetPrice && "bg-muted")}
            error={errors.price?.message}
            {...register("price")}
          />
          {!canSetPrice && <p className="text-xs text-muted-foreground">Butuh izin ubah harga jual.</p>}
        </div>
        <FormField id="duration_minutes" label="Estimasi durasi (menit)" inputMode="numeric" error={errors.duration_minutes?.message} {...register("duration_minutes")} />
        <div className="grid gap-1.5">
          <label htmlFor="commission_type" className="text-sm font-medium">
            Komisi mekanik
          </label>
          <select id="commission_type" className={inputClass} {...register("commission_type")}>
            <option value="percent">Persen dari harga jasa</option>
            <option value="fixed">Nominal tetap (Rp)</option>
          </select>
        </div>
        <FormField
          id="commission_value"
          label={commissionType === "percent" ? "Besar komisi (%)" : "Besar komisi (Rp)"}
          inputMode="decimal"
          error={errors.commission_value?.message}
          {...register("commission_value")}
        />
        <FormField id="warranty_days" label="Garansi jasa (hari)" inputMode="numeric" error={errors.warranty_days?.message} {...register("warranty_days")} />
        <Controller
          control={control}
          name="is_taxable"
          render={({ field }) => (
            <label className="flex cursor-pointer items-center gap-3 self-end pb-2">
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <span className="text-sm">Kena PPN</span>
            </label>
          )}
        />
      </fieldset>

      {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : id ? "Simpan perubahan" : "Simpan jasa"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/inventory/jasa" />}>
            Kembali
          </Button>
          {id && (
            <Button type="button" variant="outline" disabled={pending} onClick={toggleActive} className="sm:ml-auto">
              {isActive ? "Nonaktifkan jasa" : "Aktifkan jasa"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
