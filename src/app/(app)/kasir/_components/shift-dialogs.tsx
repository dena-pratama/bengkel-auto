"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import type { ExpenseAccount } from "@/lib/cashier";
import { toNumber } from "@/lib/validation/common";
import { DENOMINATIONS } from "@/lib/validation/cashier";
import { addCashOutAction, closeShiftAction, openShiftAction } from "../actions";

type Result = { ok: true } | { ok: false; error: string };

/** Dialog kecil: jalankan aksi, tutup, toast, segarkan halaman */
function useAction(success: string) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const run = async (fn: () => Promise<Result>) => {
    setError(null);
    setPending(true);
    const r = await fn();
    setPending(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.success(success);
    router.refresh();
  };
  return { open, setOpen, error, setError, pending, run };
}

export function OpenShiftDialog() {
  const a = useAction("Shift dibuka.");
  const [opening, setOpening] = useState("");
  return (
    <>
      <Button onClick={() => a.setOpen(true)}>
        <Play className="size-4" /> Buka shift
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title="Buka shift kas" description="Hitung uang di laci, lalu isi sebagai modal awal." size="md">
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Modal awal di laci (Rp)
            <input inputMode="numeric" autoFocus value={opening} onChange={(e) => setOpening(e.target.value)} className={inputClass} />
          </label>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => openShiftAction({ opening }))}>
              {a.pending ? "Membuka..." : "Buka shift"}
            </Button>
            <Button variant="outline" onClick={() => a.setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}

export function CashOutDialog({ accounts }: { accounts: ExpenseAccount[] }) {
  const a = useAction("Kas keluar dicatat.");
  const [v, setV] = useState({ account_id: "", amount: "", note: "" });
  return (
    <>
      <Button variant="outline" onClick={() => a.setOpen(true)}>
        <HandCoins className="size-4" /> Kas keluar
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title="Kas keluar kecil" description="Bensin, parkir, makan, dan pengeluaran kecil lain dari laci." size="md">
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Kategori biaya *
            <select value={v.account_id} onChange={(e) => setV({ ...v, account_id: e.target.value })} className={inputClass}>
              <option value="">Pilih kategori</option>
              {accounts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Jumlah (Rp) *
            <input inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Keterangan *
            <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="mis. bensin mobil operasional" className={inputClass} />
          </label>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button
              disabled={a.pending}
              onClick={() =>
                a.run(async () => {
                  const r = await addCashOutAction(v);
                  if (r.ok) setV({ account_id: "", amount: "", note: "" });
                  return r;
                })
              }
            >
              Simpan
            </Button>
            <Button variant="outline" onClick={() => a.setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}

/** Tutup shift: hitung uang fisik per pecahan; selisih dengan kas seharusnya tampil langsung */
export function CloseShiftDialog({ expected }: { expected: number }) {
  const a = useAction("Shift ditutup. Menunggu persetujuan Admin/Owner.");
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const counted = DENOMINATIONS.reduce((t, d) => t + d * Math.max(0, Math.trunc(toNumber(counts[d]))), 0);
  const variance = counted - expected;
  return (
    <>
      <Button variant="outline" onClick={() => a.setOpen(true)}>
        <Lock className="size-4" /> Tutup shift
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title="Tutup shift kas" description="Hitung uang fisik di laci per pecahan." size="lg">
        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {DENOMINATIONS.map((d) => (
              <label key={d} className="flex items-center gap-3 rounded-sm border border-border px-3 py-1.5 text-sm">
                <span className="w-24 font-medium tabular-nums">{formatRupiah(d)}</span>
                <span className="text-muted-foreground">x</span>
                <input
                  inputMode="numeric"
                  aria-label={`Jumlah lembar ${formatRupiah(d)}`}
                  value={counts[d] ?? ""}
                  onChange={(e) => setCounts({ ...counts, [d]: e.target.value })}
                  className={cn(inputClass, "h-9 w-20 px-3")}
                />
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatRupiah(d * Math.max(0, Math.trunc(toNumber(counts[d]))))}</span>
              </label>
            ))}
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 border-t border-border pt-3 text-sm tabular-nums">
            <dt className="text-muted-foreground">Kas seharusnya</dt>
            <dd className="text-right">{formatRupiah(expected)}</dd>
            <dt className="text-muted-foreground">Uang fisik</dt>
            <dd className="text-right">{formatRupiah(counted)}</dd>
            <dt className="font-medium">Selisih</dt>
            <dd className={`text-right text-lg font-bold ${variance !== 0 ? "text-brand-red" : ""}`}>{formatRupiah(variance)}</dd>
          </dl>
          <label className="grid gap-1.5 text-sm font-medium">
            Catatan {variance !== 0 && "(wajib, ada selisih)"}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Penyebab selisih / catatan serah terima" className={inputClass} />
          </label>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => closeShiftAction({ counts: DENOMINATIONS.map((value) => ({ value, qty: counts[value] ?? "" })), note }))}>
              {a.pending ? "Menutup..." : "Tutup shift"}
            </Button>
            <Button variant="outline" onClick={() => a.setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}
