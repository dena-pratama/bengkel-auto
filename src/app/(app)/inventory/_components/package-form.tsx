"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import type { PackageComponent } from "@/lib/inventory";
import { formatQty, formatRupiah } from "@/lib/format";
import { packageSchema, type PackageInput } from "@/lib/validation/inventory";
import { cn } from "@/lib/utils";
import { savePackageAction, setActiveAction } from "../actions";

export type ComponentOption = { kind: "item" | "service"; id: string; label: string; price: number; unit: string };

const parseNum = (v: unknown) => Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;

export function PackageForm({
  id,
  defaults,
  options,
  allocation,
  canSetPrice,
  readOnly,
  isActive,
}: {
  id: string | null;
  defaults: PackageInput;
  options: ComponentOption[];
  allocation: PackageComponent[];
  canSetPrice: boolean;
  readOnly: boolean;
  isActive: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [pick, setPick] = useState("");
  const { register, handleSubmit, control, formState, reset } = useForm<PackageInput>({
    resolver: zodResolver(packageSchema),
    defaultValues: defaults,
  });
  const comps = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control, name: "items" });
  const price = parseNum(useWatch({ control, name: "price" }));
  const errors = formState.errors;

  const optionOf = (kind: string, cid: string) => options.find((o) => o.kind === kind && o.id === cid);
  const normalTotal = (watched ?? []).reduce((s, c) => s + (optionOf(c.kind, c.id)?.price ?? 0) * parseNum(c.qty), 0);
  const taken = new Set((watched ?? []).map((c) => `${c.kind}:${c.id}`));

  const add = () => {
    const [kind, cid] = pick.split(":");
    if (!cid || taken.has(pick)) return;
    comps.append({ kind: kind as "item" | "service", id: cid, qty: "1" });
    setPick("");
  };

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await savePackageAction(id, values);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (!id) return router.push(`/inventory/paket/${result.data.id}`);
      reset(values);
      setMessage({ ok: true, text: "Paket tersimpan." });
      router.refresh();
    });
  });

  const toggleActive = () =>
    startTransition(async () => {
      if (!id) return;
      const result = await setActiveAction("packages", id, !isActive);
      setMessage(result.ok ? { ok: true, text: isActive ? "Paket dinonaktifkan." : "Paket diaktifkan." } : { ok: false, text: result.error });
      router.refresh();
    });

  const items = options.filter((o) => o.kind === "item");
  const services = options.filter((o) => o.kind === "service");

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <fieldset disabled={readOnly || pending} className={cn(panel, "grid content-start gap-4")}>
        <h2 className="text-lg font-semibold">Data paket</h2>
        <FormField id="name" label="Nama paket *" placeholder="mis. Paket Ganti Oli" error={errors.name?.message} {...register("name")} />
        <FormField id="code" label="Kode" placeholder="Kosongkan = otomatis (PKT-001)" className="uppercase" error={errors.code?.message} {...register("code")} />
        <div className="grid gap-1.5">
          <FormField
            id="price"
            label="Harga paket (Rp)"
            inputMode="numeric"
            readOnly={!canSetPrice}
            className={cn(!canSetPrice && "bg-muted")}
            error={errors.price?.message}
            {...register("price")}
          />
          {!canSetPrice && <p className="text-xs text-muted-foreground">Butuh izin ubah harga jual.</p>}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Deskripsi
          </label>
          <textarea id="description" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("description")} />
        </div>
        <dl className="grid gap-1 rounded-sm bg-muted/60 p-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Harga normal komponen</dt>
            <dd className="tabular-nums">{formatRupiah(normalTotal)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>{price <= normalTotal ? "Hemat pelanggan" : "Lebih mahal dari normal"}</dt>
            <dd className={cn("tabular-nums", price > normalTotal && "text-brand-red")}>{formatRupiah(Math.abs(normalTotal - price))}</dd>
          </div>
        </dl>
      </fieldset>

      <section className={cn(panel, "grid content-start gap-4")}>
        <div>
          <h2 className="text-lg font-semibold">Komponen</h2>
          <p className="text-xs text-muted-foreground">Saat dijual, paket dipecah ke komponen: stok barang berkurang & komisi jasa tetap terhitung.</p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className={inputClass} aria-label="Pilih komponen">
              <option value="">— Pilih barang atau jasa —</option>
              <optgroup label="Jasa">
                {services.map((o) => (
                  <option key={o.id} value={`service:${o.id}`} disabled={taken.has(`service:${o.id}`)}>
                    {o.label} · {formatRupiah(o.price)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Barang">
                {items.map((o) => (
                  <option key={o.id} value={`item:${o.id}`} disabled={taken.has(`item:${o.id}`)}>
                    {o.label} · {formatRupiah(o.price)}/{o.unit}
                  </option>
                ))}
              </optgroup>
            </select>
            <Button type="button" variant="outline" onClick={add} disabled={!pick}>
              <Plus className="size-4" /> Tambah
            </Button>
          </div>
        )}
        {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}
        <ul className="grid gap-2">
          {comps.fields.map((f, i) => {
            const o = optionOf(f.kind, f.id);
            const line = (o?.price ?? 0) * parseNum(watched?.[i]?.qty);
            const alloc = allocation.find((a) => (f.kind === "item" ? a.item_id : a.service_id) === f.id);
            return (
              <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-2 rounded-sm border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="mr-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-2xs">{f.kind === "item" ? "Barang" : "Jasa"}</span>
                    {o?.label ?? "Komponen tidak aktif"}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Normal {formatRupiah(line)}
                    {alloc && ` · alokasi di paket ${formatRupiah(alloc.allocated_price)}`}
                  </p>
                </div>
                <label className="grid gap-0.5">
                  <span className="sr-only">Jumlah</span>
                  <input
                    inputMode="decimal"
                    aria-label={`Jumlah ${o?.label ?? ""}`}
                    className={cn(inputClass, "h-9 text-right")}
                    disabled={readOnly}
                    {...register(`items.${i}.qty`)}
                  />
                  <span className="text-right text-2xs text-muted-foreground">{f.kind === "item" ? o?.unit : "kali"}</span>
                </label>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Hapus komponen" onClick={() => comps.remove(i)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {allocation.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Alokasi harga paket ke komponen dihitung proporsional terhadap harga normal ({allocation.map((a) => `${formatQty(a.qty)}× ${a.name}`).join(", ")}),
            agar laporan laba per item tetap benar.
          </p>
        )}
      </section>

      <div className="grid gap-3 lg:col-span-2">
        {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : id ? "Simpan perubahan" : "Simpan paket"}
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/inventory/paket" />}>
              Kembali
            </Button>
            {id && (
              <Button type="button" variant="outline" disabled={pending} onClick={toggleActive} className="sm:ml-auto">
                {isActive ? "Nonaktifkan paket" : "Aktifkan paket"}
              </Button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
