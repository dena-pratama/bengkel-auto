"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { formatRupiah } from "@/lib/format";
import { toNumber } from "@/lib/validation/common";
import { METHODS, METHOD_LABEL, type PaymentLineInput, type PaymentsInput } from "@/lib/validation/cashier";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Baris pembayaran (split payment): metode + jumlah (+ referensi untuk non-tunai).
 * `due` = jumlah yang harus dibayar; sisanya menjadi piutang. Untuk tunai, isian "uang diterima" menghitung kembalian.
 * Kolom PIN muncul jika server meminta persetujuan (batas diskon / kredit).
 */
export function PaymentLines({
  due,
  allowCredit,
  submitLabel,
  onSubmit,
  onDone,
  extra,
}: {
  due: number;
  allowCredit: boolean;
  submitLabel: string;
  onSubmit: (v: PaymentsInput) => Promise<Result>;
  onDone: () => void;
  extra?: React.ReactNode;
}) {
  const [lines, setLines] = useState<PaymentLineInput[]>([{ method: "cash", amount: due > 0 ? String(due) : "", reference: "" }]);
  const [received, setReceived] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const paid = lines.reduce((t, l) => t + toNumber(l.amount), 0);
  const rest = due - paid;
  const cashLine = lines.find((l) => l.method === "cash");
  const change = cashLine && toNumber(received) > 0 ? toNumber(received) - toNumber(cashLine.amount) : null;
  const update = (i: number, patch: Partial<PaymentLineInput>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const needsPin = (error ?? "").includes("PIN");

  const submit = async () => {
    setError(null);
    if (!allowCredit && rest > 0.004) return setError("Pembayaran belum menutup tagihan.");
    if (rest < -0.004) return setError("Pembayaran melebihi tagihan.");
    setPending(true);
    const r = await onSubmit({ payments: lines, pin });
    setPending(false);
    if (!r.ok) return setError(r.error);
    onDone();
  };

  return (
    <div className="grid gap-3">
      {extra}
      <ul className="grid gap-2">
        {lines.map((l, i) => (
          <li key={i} className="grid gap-2 rounded-sm border border-border p-2 sm:grid-cols-[190px_1fr_1fr_auto] sm:items-center">
            <select aria-label="Metode bayar" value={l.method} onChange={(e) => update(i, { method: e.target.value as PaymentLineInput["method"] })} className={inputClass}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
            <input aria-label="Jumlah bayar" inputMode="numeric" placeholder="Jumlah (Rp)" value={String(l.amount ?? "")} onChange={(e) => update(i, { amount: e.target.value })} className={inputClass} />
            <input
              aria-label="Referensi"
              placeholder={l.method === "cash" ? "Tanpa referensi" : "No. referensi (opsional)"}
              disabled={l.method === "cash"}
              value={l.reference}
              onChange={(e) => update(i, { reference: e.target.value })}
              className={inputClass}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Hapus metode" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { method: "transfer", amount: rest > 0 ? String(rest) : "", reference: "" }])}>
          <Plus className="size-3.5" /> Tambah metode
        </Button>
        {cashLine && (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Uang diterima</span>
            <input aria-label="Uang diterima" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} className={`${inputClass} w-36`} />
          </label>
        )}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 border-t border-border pt-3 text-sm tabular-nums">
        <dt className="text-muted-foreground">Tagihan</dt>
        <dd className="text-right">{formatRupiah(due)}</dd>
        <dt className="text-muted-foreground">Dibayar sekarang</dt>
        <dd className="text-right">{formatRupiah(paid)}</dd>
        <dt className="font-medium">{rest > 0 ? "Sisa (piutang)" : "Selisih"}</dt>
        <dd className={`text-right font-semibold ${rest < 0 ? "text-brand-red" : ""}`}>{formatRupiah(rest)}</dd>
        {change != null && (
          <>
            <dt className="font-medium">Kembalian</dt>
            <dd className={`text-right text-lg font-bold ${change < 0 ? "text-brand-red" : ""}`}>{formatRupiah(change)}</dd>
          </>
        )}
      </dl>
      {rest > 0.004 && allowCredit && <p className="text-xs text-muted-foreground">Sisa tagihan dicatat sebagai piutang (butuh pelanggan terdaftar dan batas kredit cukup, atau PIN Owner).</p>}
      {needsPin && (
        <label className="grid gap-1.5 text-sm font-medium">
          PIN persetujuan (6 digit)
          <input type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} className={`${inputClass} max-w-48`} />
        </label>
      )}
      <FormError message={error} />
      <div>
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Memproses..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
