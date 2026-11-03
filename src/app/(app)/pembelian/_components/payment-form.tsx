"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { formatDate, formatRupiah } from "@/lib/format";
import type { ApRow, CashBankAccount } from "@/lib/purchasing";
import { toNumber } from "@/lib/validation/common";
import { cn } from "@/lib/utils";
import { postSupplierPaymentAction } from "../actions";
import { DueBadge } from "./ui";

/** Bayar hutang: pilih supplier → centang faktur (bisa sebagian / beberapa sekaligus). */
export function PaymentForm({ open, cashAccounts, today }: { open: ApRow[]; cashAccounts: CashBankAccount[]; today: string }) {
  const router = useRouter();
  const suppliers = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number }>();
    for (const r of open) {
      const s = m.get(r.supplier_id) ?? { id: r.supplier_id, name: r.supplier_name, total: 0 };
      s.total += r.outstanding;
      m.set(r.supplier_id, s);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [open]);

  const [supplierId, setSupplierId] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [cash, setCash] = useState(cashAccounts.find((a) => a.is_active)?.id ?? "");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const invoices = open.filter((r) => r.supplier_id === supplierId);
  const total = invoices.reduce((t, r) => t + toNumber(amounts[r.receipt_id]), 0);

  const submit = () =>
    startTransition(async () => {
      setMessage(null);
      const r = await postSupplierPaymentAction({
        supplier_id: supplierId,
        payment_date: date,
        cash_bank_account_id: cash,
        notes,
        allocations: invoices.map((i) => ({ receipt_id: i.receipt_id, amount: amounts[i.receipt_id] ?? "" })),
      });
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      setMessage({ ok: true, text: `Pembayaran ${formatRupiah(total)} tercatat.` });
      setAmounts({});
      router.refresh();
    });

  if (suppliers.length === 0) return null;

  return (
    <section className={cn(panel, "grid gap-4")}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Banknote className="size-5" /> Bayar hutang
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-medium">
          Supplier
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setAmounts({});
            }}
            className={inputClass}
          >
            <option value="">— Pilih supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatRupiah(s.total)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Dari akun
          <select value={cash} onChange={(e) => setCash(e.target.value)} className={inputClass}>
            {cashAccounts
              .filter((a) => a.is_active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Tanggal bayar
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
      </div>

      {supplierId && (
        <>
          <ul className="grid gap-2">
            {invoices.map((r) => {
              const checked = toNumber(amounts[r.receipt_id]) > 0;
              return (
                <li key={r.receipt_id} className={cn("grid gap-2 rounded-sm border p-3 sm:grid-cols-[auto_minmax(0,1fr)_150px] sm:items-center", checked ? "border-brand-blue bg-brand-blue-soft/40" : "border-border")}>
                  <input
                    type="checkbox"
                    aria-label={`Bayar ${r.gr_no}`}
                    checked={checked}
                    onChange={(e) => setAmounts((a) => ({ ...a, [r.receipt_id]: e.target.checked ? String(r.outstanding) : "" }))}
                    className="size-4 accent-[var(--brand-blue-ink)]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span className="font-mono">{r.gr_no}</span>
                      {r.invoice_no && <span className="text-muted-foreground"> · Faktur {r.invoice_no}</span>}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      Jatuh tempo {formatDate(r.due_date)} <DueBadge daysOverdue={r.days_overdue} /> · sisa {formatRupiah(r.outstanding)}
                    </p>
                  </div>
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    value={amounts[r.receipt_id] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [r.receipt_id]: e.target.value }))}
                    aria-label={`Jumlah bayar ${r.gr_no}`}
                    className={cn(inputClass, "text-right")}
                  />
                </li>
              );
            })}
          </ul>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional), mis. transfer BCA" aria-label="Catatan pembayaran" className={inputClass} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Total dibayar <span className="text-xl font-bold tabular-nums">{formatRupiah(total)}</span>
            </p>
            <Button onClick={submit} disabled={pending || total <= 0 || !cash}>
              {pending ? "Menyimpan..." : "Simpan pembayaran"}
            </Button>
          </div>
        </>
      )}
      {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
    </section>
  );
}
