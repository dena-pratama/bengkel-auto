"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError, FormField } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import type { Brand, Category, Location, Unit } from "@/lib/inventory";
import { itemSchema, type ItemData, type ItemInput } from "@/lib/validation/inventory";
import { cn } from "@/lib/utils";
import { saveItemAction, setActiveAction } from "../actions";

export type ItemLookups = { categories: Category[]; brands: Brand[]; units: Unit[]; locations: Location[] };

function Select({ id, label, error, children, ...props }: React.ComponentProps<"select"> & { label: string; error?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} aria-invalid={Boolean(error)} className={inputClass} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ItemForm({
  id,
  defaults,
  lookups,
  baseUnitLocked,
  canSetPrice,
  readOnly,
  isActive,
}: {
  id: string | null;
  defaults: ItemInput;
  lookups: ItemLookups;
  baseUnitLocked: boolean;
  canSetPrice: boolean;
  readOnly: boolean;
  isActive: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, formState, reset } = useForm<ItemInput, unknown, ItemData>({
    resolver: zodResolver(itemSchema),
    defaultValues: defaults,
  });
  const units = useFieldArray({ control, name: "units" });
  const parts = useFieldArray({ control, name: "part_numbers" });
  const baseUnitId = useWatch({ control, name: "base_unit_id" });
  const baseCode = lookups.units.find((u) => u.id === baseUnitId)?.code ?? "satuan dasar";
  const errors = formState.errors;

  // Kategori: induk lalu sub (berindentasi)
  const parents = lookups.categories.filter((c) => !c.parent_id && (c.is_active || c.id === defaults.category_id));
  const childrenOf = (pid: string) => lookups.categories.filter((c) => c.parent_id === pid && (c.is_active || c.id === defaults.category_id));
  const activeOr = <T extends { id: string; is_active: boolean }>(list: T[], keep: unknown) => list.filter((x) => x.is_active || x.id === keep);

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveItemAction(id, values as unknown as ItemInput);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (!id) return router.push(`/inventory/barang/${result.data.id}`);
      reset(values as unknown as ItemInput);
      setMessage({ ok: true, text: "Barang tersimpan." });
      router.refresh();
    });
  });

  const toggleActive = () =>
    startTransition(async () => {
      if (!id) return;
      const result = await setActiveAction("items", id, !isActive);
      setMessage(result.ok ? { ok: true, text: isActive ? "Barang dinonaktifkan." : "Barang diaktifkan." } : { ok: false, text: result.error });
      router.refresh();
    });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset disabled={readOnly || pending} className="grid gap-4">
        <section className={cn(panel, "grid gap-4 sm:grid-cols-2")}>
          <h2 className="text-lg font-semibold sm:col-span-2">Data barang</h2>
          <div className="sm:col-span-2">
            <FormField id="name" label="Nama barang *" placeholder="mis. Filter Oli Avanza" error={errors.name?.message} {...register("name")} />
          </div>
          <FormField id="sku" label="SKU" placeholder="Kosongkan = otomatis (BRG-00001)" className="uppercase" error={errors.sku?.message} {...register("sku")} />
          <Select id="brand_id" label="Merek" error={errors.brand_id?.message} {...register("brand_id")}>
            <option value="">Tanpa merek</option>
            {activeOr(lookups.brands, defaults.brand_id).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select id="category_id" label="Kategori" error={errors.category_id?.message} {...register("category_id")}>
            <option value="">Tanpa kategori</option>
            {parents.map((p) => [
              <option key={p.id} value={p.id}>
                {p.name}
              </option>,
              ...childrenOf(p.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {"   "}
                  {p.name} › {c.name}
                </option>
              )),
            ])}
          </Select>
          <Select id="default_location_id" label="Lokasi default" error={errors.default_location_id?.message} {...register("default_location_id")}>
            <option value="">Belum ditentukan</option>
            {activeOr(lookups.locations, defaults.default_location_id).map((l) => (
              <option key={l.id} value={l.id}>
                {l.path} · {l.name}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <div className="grid gap-1.5">
              <label htmlFor="notes" className="text-sm font-medium">
                Catatan
              </label>
              <textarea id="notes" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("notes")} />
            </div>
          </div>
        </section>

        <section className={cn(panel, "grid gap-4 sm:grid-cols-2")}>
          <h2 className="text-lg font-semibold sm:col-span-2">Harga & stok</h2>
          <div className="grid gap-1.5">
            <FormField
              id="sell_price"
              label="Harga jual (Rp)"
              inputMode="numeric"
              // readOnly (bukan disabled): field disabled tidak ikut terkirim → harga terbaca 0
              readOnly={!canSetPrice}
              className={cn(!canSetPrice && "bg-muted")}
              error={errors.sell_price?.message}
              {...register("sell_price")}
            />
            {!canSetPrice && <p className="text-xs text-muted-foreground">Butuh izin ubah harga jual.</p>}
          </div>
          <Select id="base_unit_id" label="Satuan dasar *" disabled={baseUnitLocked} error={errors.base_unit_id?.message} {...register("base_unit_id")}>
            <option value="">Pilih</option>
            {activeOr(lookups.units, defaults.base_unit_id).map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} · {u.name}
              </option>
            ))}
          </Select>
          {baseUnitLocked && <p className="-mt-2 text-xs text-muted-foreground sm:col-start-2">Terkunci karena barang sudah punya mutasi stok.</p>}
          <FormField id="min_stock" label={`Stok minimum (${baseCode})`} inputMode="decimal" error={errors.min_stock?.message} {...register("min_stock")} />
          <FormField id="warranty_days" label="Garansi part (hari)" inputMode="numeric" error={errors.warranty_days?.message} {...register("warranty_days")} />
          <Controller
            control={control}
            name="is_taxable"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                <span className="text-sm">Kena PPN (dipakai saat fitur pajak aktif)</span>
              </label>
            )}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={cn(panel, "grid content-start gap-3")}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Konversi satuan</h2>
                <p className="text-xs text-muted-foreground">Stok selalu disimpan dalam {baseCode}.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => units.append({ unit_id: "", factor: "", is_purchase: true, is_sale: false })}>
                <Plus className="size-4" /> Tambah
              </Button>
            </div>
            {units.fields.length === 0 && <p className="text-sm text-muted-foreground">Belum ada. Contoh: 1 box = 12 pcs.</p>}
            {units.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 rounded-sm border border-border p-3">
                <Select id={`units.${i}.unit_id`} label="1 satuan" error={errors.units?.[i]?.unit_id?.message} {...register(`units.${i}.unit_id`)}>
                  <option value="">Pilih</option>
                  {lookups.units
                    .filter((u) => u.id !== baseUnitId && (u.is_active || u.id === f.unit_id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code}
                      </option>
                    ))}
                </Select>
                <FormField
                  id={`units.${i}.factor`}
                  label={`= berapa ${baseCode}`}
                  inputMode="decimal"
                  error={errors.units?.[i]?.factor?.message}
                  {...register(`units.${i}.factor`)}
                />
                <Button type="button" variant="ghost" size="icon" aria-label="Hapus konversi" onClick={() => units.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
                <div className="col-span-3 flex flex-wrap gap-4 text-sm">
                  <Controller
                    control={control}
                    name={`units.${i}.is_purchase`}
                    render={({ field }) => (
                      <label className="flex items-center gap-2">
                        <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} /> Satuan beli
                      </label>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`units.${i}.is_sale`}
                    render={({ field }) => (
                      <label className="flex items-center gap-2">
                        <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} /> Satuan jual
                      </label>
                    )}
                  />
                </div>
              </div>
            ))}
          </section>

          <section className={cn(panel, "grid content-start gap-3")}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Part number</h2>
                <p className="text-xs text-muted-foreground">Nomor OEM dan nomor alternatif.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => parts.append({ part_number: "", is_oem: parts.fields.length === 0 })}>
                <Plus className="size-4" /> Tambah
              </Button>
            </div>
            {parts.fields.length === 0 && <p className="text-sm text-muted-foreground">Belum ada part number.</p>}
            {parts.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2">
                <FormField
                  id={`part_numbers.${i}.part_number`}
                  label={`Part number ${i + 1}`}
                  className="font-mono uppercase"
                  error={errors.part_numbers?.[i]?.part_number?.message}
                  {...register(`part_numbers.${i}.part_number`)}
                />
                <Controller
                  control={control}
                  name={`part_numbers.${i}.is_oem`}
                  render={({ field }) => (
                    <label className="flex h-10 items-center gap-2 text-sm">
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} /> OEM
                    </label>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" aria-label="Hapus part number" onClick={() => parts.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </section>
        </div>
      </fieldset>

      {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : id ? "Simpan perubahan" : "Simpan barang"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/inventory" />}>
            Kembali
          </Button>
          {id && (
            <Button type="button" variant="outline" disabled={pending} onClick={toggleActive} className="sm:ml-auto">
              {isActive ? "Nonaktifkan barang" : "Aktifkan barang"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
