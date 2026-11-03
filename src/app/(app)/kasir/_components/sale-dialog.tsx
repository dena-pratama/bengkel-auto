"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { formatQty, formatRupiah } from "@/lib/format";
import type { CatalogOption } from "@/lib/service";
import { toNumber } from "@/lib/validation/common";
import { METHODS, METHOD_LABEL, type DepositInput, type SaleInput } from "@/lib/validation/cashier";
import { cn } from "@/lib/utils";
import { CatalogPicker } from "../../servis/_components/pickers";
import { invoiceWorkOrderAction, postSaleAction, previewInvoiceAction, recordDepositAction, saleTotalAction, saveSaleAction } from "../actions";
import { PaymentLines } from "./payment-lines";

export type CustomerOption = { id: string; name: string; phone: string | null };
export type Draft = { id: string; customer_id: string; discount_amount: string; notes: string; lines: SaleInput["lines"] };

const emptySale: SaleInput = { customer_id: "", discount_amount: "", notes: "", lines: [] };

/**
 * Penjualan part langsung (POS). Langkah 1: isi barang dan simpan (ditahan); langkah 2: terima pembayaran
 * dengan total persis dari server (termasuk PPN). Menutup dialog di langkah 2 membiarkan transaksi ditahan.
 */
export function SaleDialog({
  catalog,
  customers,
  shiftOpen,
  draft,
  label = "Penjualan baru",
  variant = "default",
}: {
  catalog: CatalogOption[];
  customers: CustomerOption[];
  shiftOpen: boolean;
  draft?: Draft;
  label?: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(draft?.id ?? null);
  const [total, setTotal] = useState<number | null>(null);
  const [form, setForm] = useState<SaleInput>(draft ? { customer_id: draft.customer_id, discount_amount: draft.discount_amount, notes: draft.notes, lines: draft.lines } : emptySale);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const parts = catalog.filter((c) => c.type === "part");
  const byId = new Map(parts.map((p) => [p.id, p]));
  const estimate = form.lines.reduce((t, l) => t + Math.max(toNumber(l.qty) * (byId.get(l.item_id)?.price ?? 0) - toNumber(l.discount_amount), 0), 0) - toNumber(form.discount_amount);

  const reset = () => {
    setSaleId(draft?.id ?? null);
    setTotal(null);
    setError(null);
    if (!draft) setForm(emptySale);
  };
  const close = () => {
    setOpen(false);
    reset();
    router.refresh();
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const r = await saveSaleAction(saleId, form);
      if (!r.ok) return setError(r.error);
      const t = await saleTotalAction(r.data.id);
      if (!t.ok) return setError(t.error);
      setSaleId(r.data.id);
      setTotal(t.data.total);
    });

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
      <FormDialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title={total == null ? "Penjualan part" : "Pembayaran"} description={total == null ? "Cari barang, pilih pelanggan (opsional), lalu lanjut ke pembayaran." : "Transaksi tersimpan sebagai draft sampai dibayar."} size="xl">
        {total == null ? (
          <div className="grid gap-4">
            <section className={cn(panel, "grid gap-3")}>
              <CatalogPicker
                options={parts}
                onPick={(c) =>
                  setForm((f) => {
                    const idx = f.lines.findIndex((l) => l.item_id === c.id);
                    if (idx >= 0) return { ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, qty: String(toNumber(l.qty) + 1) } : l)) };
                    return { ...f, lines: [...f.lines, { item_id: c.id, qty: "1", discount_amount: "" }] };
                  })
                }
              />
              <ul className="grid gap-2">
                {form.lines.map((l, i) => {
                  const c = byId.get(l.item_id);
                  const sub = Math.max(toNumber(l.qty) * (c?.price ?? 0) - toNumber(l.discount_amount), 0);
                  return (
                    <li key={l.item_id} className="grid gap-2 rounded-sm border border-border p-3 sm:grid-cols-[minmax(0,1.6fr)_90px_130px_130px_auto] sm:items-end">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c?.name ?? "Tidak aktif"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRupiah(c?.price)} / {c?.unit} · stok {formatQty(c?.stock)}
                        </p>
                      </div>
                      <label className="grid gap-1 text-sm font-medium">
                        Jumlah
                        <input inputMode="decimal" value={String(l.qty ?? "")} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm font-medium">
                        Diskon (Rp)
                        <input inputMode="numeric" value={String(l.discount_amount ?? "")} onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, discount_amount: e.target.value } : x)) })} className={inputClass} />
                      </label>
                      <p className="text-sm font-semibold tabular-nums sm:pb-2.5 sm:text-right">{formatRupiah(sub)}</p>
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className={cn(panel, "grid gap-3 sm:grid-cols-[1fr_200px]")}>
              <label className="grid gap-1.5 text-sm font-medium">
                Pelanggan
                <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className={inputClass}>
                  <option value="">Umum (tanpa data pelanggan)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Diskon total (Rp)
                <input inputMode="numeric" value={String(form.discount_amount ?? "")} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} className={inputClass} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                Catatan
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
              </label>
              <p className="flex items-baseline justify-end gap-3 sm:col-span-2">
                <span className="text-sm text-muted-foreground">Perkiraan total (sebelum PPN jika aktif)</span>
                <span className="text-xl font-bold tabular-nums">{formatRupiah(Math.max(estimate, 0))}</span>
              </p>
            </section>
            {!shiftOpen && <p className="text-sm text-brand-red">Shift belum dibuka. Transaksi bisa ditahan, tetapi pembayaran butuh shift terbuka.</p>}
            <FormError message={error} />
            <div className="flex gap-2">
              <Button disabled={pending || form.lines.length === 0} onClick={save}>
                {pending ? "Menyimpan..." : "Lanjut ke pembayaran"}
              </Button>
              <Button variant="outline" onClick={close}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <PaymentLines
            due={total}
            allowCredit
            submitLabel="Bayar dan posting"
            onSubmit={(v) => postSaleAction(saleId!, v)}
            onDone={() => {
              toast.success("Penjualan diposting.");
              const id = saleId;
              setOpen(false);
              reset();
              router.push(`/kasir/penjualan/${id}`);
            }}
            extra={
              <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setTotal(null)}>
                Ubah barang
              </Button>
            }
          />
        )}
      </FormDialog>
    </>
  );
}

/** Invoice WO Siap Diambil: total (termasuk PPN) dari server, DP terpakai otomatis, bayar split atau tempo */
export function InvoiceDialog({ woId, woNo, deposit, label = "Buat invoice & bayar" }: { woId: string; woNo: string; deposit: number; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    previewInvoiceAction(woId).then((r) => {
      if (cancelled) return;
      if (r.ok) setTotal(r.data.total);
      else setError(r.error);
    });
    return () => {
      cancelled = true;
      setTotal(null);
      setError(null);
    };
  }, [open, woId]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <FormDialog open={open} onOpenChange={setOpen} title={`Invoice ${woNo}`} description="Total sudah termasuk semua pekerjaan dan part. DP yang diterima dipotong otomatis." size="lg">
        {error ? (
          <FormError message={error} />
        ) : total == null ? (
          <p className="text-sm text-muted-foreground">Menghitung total…</p>
        ) : (
          <PaymentLines
            due={Math.max(total - deposit, 0)}
            allowCredit
            submitLabel="Terbitkan invoice"
            onSubmit={(v) => invoiceWorkOrderAction(woId, v)}
            onDone={() => {
              toast.success("Invoice diterbitkan.");
              setOpen(false);
              router.refresh();
            }}
            extra={
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 text-sm tabular-nums">
                <dt className="text-muted-foreground">Total invoice</dt>
                <dd className="text-right font-semibold">{formatRupiah(total)}</dd>
                {deposit > 0 && (
                  <>
                    <dt className="text-muted-foreground">DP dipakai</dt>
                    <dd className="text-right">-{formatRupiah(deposit)}</dd>
                  </>
                )}
              </dl>
            }
          />
        )}
      </FormDialog>
    </>
  );
}

export function DepositDialog({ woId, woNo }: { woId: string; woNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<DepositInput>({ method: "cash", amount: "", reference: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await recordDepositAction(woId, v);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setV({ method: "cash", amount: "", reference: "" });
      toast.success("DP dicatat.");
      router.refresh();
    });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Terima DP
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title={`DP ${woNo}`} description="Uang muka dipotong otomatis saat invoice diterbitkan." size="md">
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Metode
            <select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value as DepositInput["method"] })} className={inputClass}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Jumlah DP (Rp)
            <input inputMode="numeric" value={String(v.amount ?? "")} onChange={(e) => setV({ ...v, amount: e.target.value })} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Referensi (opsional)
            <input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className={inputClass} />
          </label>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button disabled={pending} onClick={submit}>
              Simpan DP
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
