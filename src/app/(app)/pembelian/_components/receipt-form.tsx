"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError, FormField } from "@/components/form-field";
import { ItemPicker } from "@/components/item-picker";
import { inputClass, panel } from "@/components/page-kit";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import type { Location } from "@/lib/inventory";
import type { CashBankAccount, ItemOption, Supplier } from "@/lib/purchasing";
import { toNumber } from "@/lib/validation/common";
import { receiptSchema, type ReceiptInput } from "@/lib/validation/purchasing";
import { cn } from "@/lib/utils";
import { postGoodsReceiptAction } from "../actions";
import { SelectField } from "./ui";

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ReceiptForm({
  defaults,
  suppliers,
  items,
  locations,
  cashAccounts,
  ppnEnabled,
  canPay,
  poLabel,
}: {
  defaults: ReceiptInput;
  suppliers: Supplier[];
  items: ItemOption[];
  locations: Location[];
  cashAccounts: CashBankAccount[];
  ppnEnabled: boolean;
  canPay: boolean;
  poLabel: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, formState } = useForm<ReceiptInput>({ resolver: zodResolver(receiptSchema), defaultValues: defaults });
  const lines = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control, name: "items" }) ?? [];
  const [supplierId, receiptDate, dueDate, ppnRaw, payNow] = useWatch({ control, name: ["supplier_id", "receipt_date", "due_date", "ppn_amount", "pay_now"] });
  const errors = formState.errors;
  const byId = new Map(items.map((i) => [i.id, i]));
  const bins = locations.filter((l) => l.is_active);
  const supplier = suppliers.find((s) => s.id === supplierId);
  const autoDue = supplier && receiptDate ? addDays(receiptDate, supplier.payment_terms_days) : null;

  const lineTotal = (l: (typeof watched)[number]) => Math.max(0, toNumber(l?.qty) * toNumber(l?.unit_price) - toNumber(l?.discount_amount));
  const subtotal = watched.reduce((t, l) => t + lineTotal(l), 0);
  const ppn = toNumber(ppnRaw);
  const total = subtotal + ppn;

  const addItem = (id: string) => {
    const it = byId.get(id);
    if (!it) return;
    const unit = it.units.find((u) => u.factor > 1 && u.is_purchase) ?? it.units[0];
    lines.append({
      item_id: id,
      unit_id: unit.unit_id,
      qty: "1",
      unit_price: "",
      discount_amount: "",
      location_id: it.default_location_id ?? bins[0]?.id ?? "",
      po_item_id: "",
    });
  };

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const r = await postGoodsReceiptAction(values);
      if (!r.ok) return setError(r.error);
      router.push(`/pembelian/penerimaan/${r.data.id}`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <section className={cn(panel, "grid gap-4 sm:grid-cols-2 lg:grid-cols-4")}>
        {poLabel ? (
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Dari PO</span>
            <p className="flex h-10 items-center rounded-sm bg-muted px-3 font-mono text-sm">{poLabel}</p>
            <input type="hidden" {...register("supplier_id")} />
          </div>
        ) : (
          <SelectField id="supplier_id" label="Supplier *" error={errors.supplier_id?.message} {...register("supplier_id")}>
            <option value="">Pilih supplier</option>
            {suppliers
              .filter((s) => s.is_active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </SelectField>
        )}
        <FormField id="receipt_date" label="Tanggal terima" type="date" {...register("receipt_date")} />
        <FormField id="invoice_no" label="No. faktur supplier" {...register("invoice_no")} />
        <FormField id="invoice_date" label="Tanggal faktur" type="date" {...register("invoice_date")} />
        <div className="grid gap-1.5">
          <FormField id="due_date" label="Jatuh tempo" type="date" {...register("due_date")} />
          {!dueDate && autoDue && <p className="text-xs text-muted-foreground">Kosong = otomatis {formatDate(autoDue)} (termin supplier)</p>}
        </div>
        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
          <label htmlFor="notes" className="text-sm font-medium">
            Catatan
          </label>
          <input id="notes" className={inputClass} {...register("notes")} />
        </div>
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h2 className="text-lg font-semibold">Barang diterima</h2>
        {!poLabel && (
          <ItemPicker
            items={items.map((i) => ({ id: i.id, sku: i.sku, name: i.name, base_unit: i.base_unit, qty: i.qty }))}
            exclude={watched.map((l) => l.item_id)}
            onPick={(i) => addItem(i.id)}
          />
        )}
        {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}
        <ul className="grid gap-2">
          {lines.fields.map((f, idx) => {
            const it = byId.get(f.item_id);
            const unitId = watched[idx]?.unit_id;
            const factor = it?.units.find((u) => u.unit_id === unitId)?.factor ?? 1;
            const baseQty = toNumber(watched[idx]?.qty) * factor;
            return (
              <li key={f.id} className="grid gap-2 rounded-sm border border-border p-3 lg:grid-cols-[minmax(0,1.4fr)_96px_90px_130px_110px_minmax(0,1fr)_auto] lg:items-end">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it?.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    <span className="font-mono">{it?.sku}</span> · +{formatQty(baseQty)} {it?.base_unit} · {formatRupiah(lineTotal(watched[idx]))}
                  </p>
                </div>
                {f.po_item_id ? (
                  // Satuan mengikuti PO (dikunci); nilainya dikirim lewat input tersembunyi
                  <div className="grid gap-1.5">
                    <span className="text-sm font-medium">Satuan</span>
                    <p className="flex h-10 items-center rounded-sm bg-muted px-3 text-sm">{it?.units.find((u) => u.unit_id === unitId)?.code}</p>
                    <input type="hidden" {...register(`items.${idx}.unit_id`)} />
                  </div>
                ) : (
                  <SelectField id={`items.${idx}.unit_id`} label="Satuan" {...register(`items.${idx}.unit_id`)}>
                    {it?.units.map((u) => (
                      <option key={u.unit_id} value={u.unit_id}>
                        {u.code}
                      </option>
                    ))}
                  </SelectField>
                )}
                <FormField id={`items.${idx}.qty`} label="Jumlah" inputMode="decimal" error={errors.items?.[idx]?.qty?.message} {...register(`items.${idx}.qty`)} />
                <FormField id={`items.${idx}.unit_price`} label="Harga / satuan" inputMode="numeric" error={errors.items?.[idx]?.unit_price?.message} {...register(`items.${idx}.unit_price`)} />
                <FormField id={`items.${idx}.discount_amount`} label="Diskon (Rp)" inputMode="numeric" {...register(`items.${idx}.discount_amount`)} />
                <SelectField id={`items.${idx}.location_id`} label="Lokasi rak" error={errors.items?.[idx]?.location_id?.message} {...register(`items.${idx}.location_id`)}>
                  <option value="">Pilih</option>
                  {bins.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.path}
                    </option>
                  ))}
                </SelectField>
                <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => lines.remove(idx)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cn(panel, "grid content-start gap-3")}>
          <FormField id="ppn_amount" label="PPN di faktur supplier (Rp)" inputMode="numeric" error={errors.ppn_amount?.message} {...register("ppn_amount")} />
          <p className="text-xs text-muted-foreground">
            {ppnEnabled
              ? "Bengkel PKP: PPN dicatat sebagai PPN Masukan (bisa dikreditkan), tidak masuk HPP."
              : "Bengkel belum PKP: PPN ikut masuk harga pokok (HPP) barang."}
          </p>
          {canPay && (
            <>
              <Controller
                control={control}
                name="pay_now"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    <span className="text-sm">Bayar sekarang (tunai / transfer)</span>
                  </label>
                )}
              />
              {payNow && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField id="cash_bank_account_id" label="Dari akun" error={errors.cash_bank_account_id?.message} {...register("cash_bank_account_id")}>
                    <option value="">Pilih</option>
                    {cashAccounts
                      .filter((a) => a.is_active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </SelectField>
                  <FormField id="paid_amount" label="Jumlah dibayar" inputMode="numeric" placeholder={String(total)} {...register("paid_amount")} />
                </div>
              )}
            </>
          )}
        </section>
        <section className={cn(panel, "grid content-start gap-2 text-sm")}>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal (setelah diskon)</span>
            <span className="tabular-nums">{formatRupiah(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PPN</span>
            <span className="tabular-nums">{formatRupiah(ppn)}</span>
          </div>
          <div className="flex items-end justify-between border-t border-border pt-2">
            <span className="font-medium">Total faktur / hutang</span>
            <span className="text-2xl font-bold tabular-nums">{formatRupiah(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Saat disimpan: stok bertambah, HPP rata-rata dihitung ulang, hutang & jurnal tercatat otomatis.</p>
        </section>
      </div>

      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan penerimaan"}
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/pembelian/penerimaan" />}>
          Batal
        </Button>
      </div>
    </form>
  );
}
