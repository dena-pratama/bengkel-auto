"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import { ItemPicker } from "@/components/item-picker";
import { inputClass, panel } from "@/components/page-kit";
import { formatQty, formatRupiah } from "@/lib/format";
import type { ItemOption, Supplier } from "@/lib/purchasing";
import { toNumber } from "@/lib/validation/common";
import { poSchema, type PoInput } from "@/lib/validation/purchasing";
import { cn } from "@/lib/utils";
import { savePurchaseOrderAction } from "../actions";
import { SelectField } from "./ui";

export function PoForm({ id, defaults, suppliers, items }: { id: string | null; defaults: PoInput; suppliers: Supplier[]; items: ItemOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, formState } = useForm<PoInput>({ resolver: zodResolver(poSchema), defaultValues: defaults });
  const lines = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control, name: "items" }) ?? [];
  const errors = formState.errors;
  const byId = new Map(items.map((i) => [i.id, i]));
  const total = watched.reduce((t, l) => t + toNumber(l.qty) * toNumber(l.unit_price), 0);
  const low = items.filter((i) => i.min_stock > 0 && i.qty <= i.min_stock && !watched.some((l) => l.item_id === i.id));

  const addItem = (id: string, qty = "1") => {
    const it = byId.get(id);
    if (!it) return;
    const purchaseUnit = it.units.find((u) => u.factor > 1 && u.is_purchase) ?? it.units[0];
    lines.append({ item_id: id, unit_id: purchaseUnit.unit_id, qty, unit_price: "" });
  };
  // Saran: isi sampai 2× stok minimum (dalam satuan dasar)
  const suggest = () => low.forEach((i) => addItem(i.id, String(Math.max(Math.ceil(i.min_stock * 2 - i.qty), 1))));

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await savePurchaseOrderAction(id, values);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (!id) return router.push(`/pembelian/po/${result.data.id}`);
      setMessage({ ok: true, text: "PO tersimpan." });
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <section className={cn(panel, "grid gap-4 sm:grid-cols-3")}>
        <SelectField id="supplier_id" label="Supplier *" error={errors.supplier_id?.message} {...register("supplier_id")}>
          <option value="">— Pilih supplier —</option>
          {suppliers
            .filter((s) => s.is_active || s.id === defaults.supplier_id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>
        <FormField id="order_date" label="Tanggal PO" type="date" {...register("order_date")} />
        <FormField id="expected_date" label="Perkiraan datang" type="date" {...register("expected_date")} />
        <div className="grid gap-1.5 sm:col-span-3">
          <label htmlFor="notes" className="text-sm font-medium">
            Catatan untuk supplier
          </label>
          <textarea id="notes" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("notes")} />
        </div>
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Barang dipesan</h2>
          {low.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={suggest}>
              <Sparkles className="size-4" /> Saran dari stok menipis ({low.length})
            </Button>
          )}
        </div>
        <ItemPicker
          items={items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, base_unit: i.base_unit, qty: i.qty }))}
          exclude={watched.map((l) => l.item_id)}
          onPick={(i) => addItem(i.id)}
        />
        {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}
        <ul className="grid gap-2">
          {lines.fields.map((f, idx) => {
            const it = byId.get(f.item_id);
            const unitId = watched[idx]?.unit_id;
            const factor = it?.units.find((u) => u.unit_id === unitId)?.factor ?? 1;
            const sub = toNumber(watched[idx]?.qty) * toNumber(watched[idx]?.unit_price);
            return (
              <li key={f.id} className="grid gap-2 rounded-sm border border-border p-3 sm:grid-cols-[minmax(0,1.6fr)_110px_100px_150px_auto] sm:items-end">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it?.name ?? "Barang tidak aktif"}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{it?.sku}</span> · stok {formatQty(it?.qty)} {it?.base_unit}
                    {factor !== 1 && ` · 1 = ${formatQty(factor)} ${it?.base_unit}`}
                  </p>
                </div>
                <SelectField id={`items.${idx}.unit_id`} label="Satuan" {...register(`items.${idx}.unit_id`)}>
                  {it?.units
                    .filter((u) => u.is_purchase || u.unit_id === unitId)
                    .map((u) => (
                      <option key={u.unit_id} value={u.unit_id}>
                        {u.code}
                      </option>
                    ))}
                </SelectField>
                <FormField id={`items.${idx}.qty`} label="Jumlah" inputMode="decimal" error={errors.items?.[idx]?.qty?.message} {...register(`items.${idx}.qty`)} />
                <FormField
                  id={`items.${idx}.unit_price`}
                  label="Harga / satuan"
                  inputMode="numeric"
                  error={errors.items?.[idx]?.unit_price?.message}
                  {...register(`items.${idx}.unit_price`)}
                />
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-sm font-semibold tabular-nums sm:hidden">{formatRupiah(sub)}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => lines.remove(idx)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Perkiraan total</span>
          <span className="text-xl font-bold tabular-nums">{formatRupiah(total)}</span>
        </div>
      </section>

      {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : id ? "Simpan draft" : "Simpan sebagai draft"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/pembelian" />}>
          Kembali
        </Button>
      </div>
    </form>
  );
}
