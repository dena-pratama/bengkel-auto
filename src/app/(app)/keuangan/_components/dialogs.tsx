"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, Landmark, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { formatRupiah } from "@/lib/format";
import type { AccountRow, CashBankBalance, RecurringExpense } from "@/lib/finance";
import { toNumber } from "@/lib/validation/common";
import { ACCOUNT_TYPE_LABEL, TXN_KIND_LABEL, type JournalLineInput, type TxnKind } from "@/lib/validation/finance";
import { cn } from "@/lib/utils";
import {
  closePeriodAction,
  confirmRecurringAction,
  postCashTxnAction,
  postManualJournalAction,
  reopenPeriodAction,
  reverseManualJournalAction,
  saveAccountAction,
  saveCashBankAction,
  saveRecurringAction,
  setAccountActiveAction,
  setRecurringActiveAction,
  voidCashTxnAction,
} from "../actions";

type Result = { ok: true } | { ok: false; error: string };

/** Dialog kecil: jalankan aksi, tutup, toast, segarkan halaman */
function useDialogAction(success: string) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setOpen(false);
      after?.();
      toast.success(success);
      router.refresh();
    });
  return { open, setOpen, error, setError, pending, run };
}

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <label className={cn("grid gap-1.5 text-sm font-medium", className)}>
    {label}
    {children}
  </label>
);

const KIND_ICON = { expense: ArrowUpFromLine, income: ArrowDownToLine, transfer: ArrowLeftRight, capital: Landmark, drawing: Banknote } as const;
const KIND_HINT: Record<TxnKind, string> = {
  expense: "Listrik, sewa, internet, ATK, dan biaya usaha lain.",
  income: "Pemasukan di luar penjualan, mis. jual oli bekas atau sewa lahan parkir.",
  transfer: "Pindahkan uang antar akun kas dan bank. Tidak memengaruhi laba.",
  capital: "Uang pemilik yang disetor ke usaha. Bukan pendapatan.",
  drawing: "Uang usaha yang diambil pemilik untuk keperluan pribadi. Bukan biaya usaha.",
};

export function CashTxnDialog({
  kind,
  cashAccounts,
  accounts,
  today,
  variant = "outline",
}: {
  kind: TxnKind;
  cashAccounts: CashBankBalance[];
  accounts: AccountRow[];
  today: string;
  variant?: "default" | "outline";
}) {
  const a = useDialogAction(`${TXN_KIND_LABEL[kind]} dicatat.`);
  const Icon = KIND_ICON[kind];
  const active = cashAccounts.filter((c) => c.is_active);
  const blank = { txn_date: today, cash_bank_account_id: active[0]?.cash_bank_account_id ?? "", to_cash_bank_account_id: "", account_id: "", amount: "", description: "" };
  const [v, setV] = useState(blank);
  const categories = accounts.filter((x) => x.is_active && (kind === "expense" ? x.type === "expense" || (x.type === "other" && x.system_key !== "other_income") : x.type === "revenue" || x.type === "other"));
  return (
    <>
      <Button variant={variant} onClick={() => a.setOpen(true)}>
        <Icon className="size-4" /> {TXN_KIND_LABEL[kind]}
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title={TXN_KIND_LABEL[kind]} description={KIND_HINT[kind]} size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal">
              <input type="date" max={today} value={v.txn_date} onChange={(e) => setV({ ...v, txn_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Jumlah (Rp)">
              <input inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label={kind === "income" || kind === "capital" ? "Masuk ke akun" : kind === "transfer" ? "Dari akun" : "Dibayar dari akun"}>
            <select value={v.cash_bank_account_id} onChange={(e) => setV({ ...v, cash_bank_account_id: e.target.value })} className={inputClass}>
              {active.map((c) => (
                <option key={c.cash_bank_account_id} value={c.cash_bank_account_id}>
                  {c.name} ({formatRupiah(c.balance)})
                </option>
              ))}
            </select>
          </Field>
          {kind === "transfer" && (
            <Field label="Ke akun">
              <select value={v.to_cash_bank_account_id} onChange={(e) => setV({ ...v, to_cash_bank_account_id: e.target.value })} className={inputClass}>
                <option value="">Pilih akun tujuan</option>
                {active
                  .filter((c) => c.cash_bank_account_id !== v.cash_bank_account_id)
                  .map((c) => (
                    <option key={c.cash_bank_account_id} value={c.cash_bank_account_id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {(kind === "expense" || kind === "income") && (
            <Field label={kind === "expense" ? "Kategori biaya" : "Kategori pendapatan"}>
              <select value={v.account_id} onChange={(e) => setV({ ...v, account_id: e.target.value })} className={inputClass}>
                <option value="">Pilih kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Keterangan">
            <input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="mis. Listrik bulan Oktober" className={inputClass} />
          </Field>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => postCashTxnAction({ kind, ...v }), () => setV(blank))}>
              {a.pending ? "Menyimpan..." : "Simpan"}
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

export function VoidTxnButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await voidCashTxnAction(id, reason);
      if (!r.ok) return setError(r.error);
      toast.success("Transaksi dibatalkan.");
      setOpen(false);
      router.refresh();
    });
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" /> Batalkan
      </Button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan pembatalan" className={cn(inputClass, "h-9 w-48 px-3")} />
      <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3} onClick={submit}>
        Batalkan
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Tidak
      </Button>
      <FormError message={error} />
    </span>
  );
}

// ---------------------------------------------------------------------------- Biaya rutin

export function RecurringDialog({ item, accounts, cashAccounts }: { item?: RecurringExpense; accounts: AccountRow[]; cashAccounts: CashBankBalance[] }) {
  const a = useDialogAction(item ? "Biaya rutin diperbarui." : "Biaya rutin ditambahkan.");
  const blank = {
    name: item?.name ?? "",
    account_id: item?.account_id ?? "",
    cash_bank_account_id: item?.cash_bank_account_id ?? cashAccounts.find((c) => c.is_active)?.cash_bank_account_id ?? "",
    amount: item ? String(item.amount) : "",
    day_of_month: item ? String(item.day_of_month) : "1",
  };
  const [v, setV] = useState(blank);
  return (
    <>
      <Button variant={item ? "ghost" : "outline"} size={item ? "sm" : "default"} onClick={() => a.setOpen(true)}>
        {item ? "Ubah" : (<><Plus className="size-4" /> Biaya rutin</>)}
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title={item ? "Ubah biaya rutin" : "Biaya rutin baru"} description="Template yang tinggal dikonfirmasi setiap bulan." size="md">
        <div className="grid gap-4">
          <Field label="Nama">
            <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="mis. Sewa bengkel" className={inputClass} />
          </Field>
          <Field label="Kategori biaya">
            <select value={v.account_id} onChange={(e) => setV({ ...v, account_id: e.target.value })} className={inputClass}>
              <option value="">Pilih kategori</option>
              {accounts
                .filter((x) => x.is_active && (x.type === "expense" || x.type === "other"))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Dibayar dari akun">
            <select value={v.cash_bank_account_id} onChange={(e) => setV({ ...v, cash_bank_account_id: e.target.value })} className={inputClass}>
              {cashAccounts
                .filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.cash_bank_account_id} value={c.cash_bank_account_id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah biasa (Rp)">
              <input inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Tanggal jatuh tempo (1-28)">
              <input inputMode="numeric" value={v.day_of_month} onChange={(e) => setV({ ...v, day_of_month: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => saveRecurringAction(item?.id ?? null, v))}>
              {a.pending ? "Menyimpan..." : "Simpan"}
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

export function ConfirmRecurringDialog({ item, today }: { item: RecurringExpense; today: string }) {
  const a = useDialogAction(`${item.name} dikonfirmasi.`);
  const [v, setV] = useState({ date: today, amount: String(item.amount) });
  return (
    <>
      <Button size="sm" onClick={() => a.setOpen(true)}>
        <Repeat className="size-3.5" /> Konfirmasi
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title={`Konfirmasi ${item.name}`} description={`Dibayar dari ${item.cash_bank_name}, kategori ${item.account_name}.`} size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal">
              <input type="date" max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Jumlah bulan ini (Rp)">
              <input inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => confirmRecurringAction(item.id, v))}>
              {a.pending ? "Memproses..." : "Catat pengeluaran"}
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

export function ToggleRecurringButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setRecurringActiveAction(id, !active);
          if (!r.ok) return void toast.error(r.error, { duration: 4000 });
          router.refresh();
        })
      }
    >
      {active ? "Nonaktifkan" : "Aktifkan"}
    </Button>
  );
}

// ---------------------------------------------------------------------------- Jurnal manual

const emptyLine = (): JournalLineInput => ({ account_id: "", debit: "", credit: "", memo: "" });

export function ManualJournalDialog({ accounts, today }: { accounts: AccountRow[]; today: string }) {
  const a = useDialogAction("Jurnal dicatat.");
  const blank = { date: today, description: "", lines: [emptyLine(), emptyLine()] };
  const [v, setV] = useState(blank);
  const debit = v.lines.reduce((t, l) => t + toNumber(l.debit), 0);
  const credit = v.lines.reduce((t, l) => t + toNumber(l.credit), 0);
  const balanced = debit > 0 && Math.abs(debit - credit) < 0.005;
  const setLine = (i: number, patch: Partial<JournalLineInput>) => setV({ ...v, lines: v.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  return (
    <>
      <Button variant="outline" onClick={() => a.setOpen(true)}>
        <Plus className="size-4" /> Jurnal manual
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title="Jurnal manual" description="Untuk penyesuaian. Jurnal tidak bisa diedit; koreksi lewat jurnal pembalik." size="xl">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Tanggal">
              <input type="date" max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Keterangan">
              <input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="mis. Penyesuaian biaya dibayar di muka" className={inputClass} />
            </Field>
          </div>
          <ul className="grid gap-2">
            {v.lines.map((l, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_150px_150px_minmax(0,1fr)_auto] sm:items-center">
                <select aria-label="Akun" value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })} className={inputClass}>
                  <option value="">Pilih akun</option>
                  {accounts
                    .filter((x) => x.is_active)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} {x.name}
                      </option>
                    ))}
                </select>
                <input aria-label="Debit" inputMode="numeric" placeholder="Debit" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} className={inputClass} />
                <input aria-label="Kredit" inputMode="numeric" placeholder="Kredit" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} className={inputClass} />
                <input aria-label="Catatan baris" placeholder="Catatan" value={l.memo} onChange={(e) => setLine(i, { memo: e.target.value })} className={inputClass} />
                <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" disabled={v.lines.length <= 2} onClick={() => setV({ ...v, lines: v.lines.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, lines: [...v.lines, emptyLine()] })}>
              <Plus className="size-3.5" /> Tambah baris
            </Button>
            <dl className="flex gap-5 text-sm tabular-nums">
              <div>
                <dt className="text-xs text-muted-foreground">Total debit</dt>
                <dd className="font-semibold">{formatRupiah(debit)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total kredit</dt>
                <dd className="font-semibold">{formatRupiah(credit)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Selisih</dt>
                <dd className={cn("font-semibold", !balanced && "text-brand-red")}>{formatRupiah(debit - credit)}</dd>
              </div>
            </dl>
          </div>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending || !balanced} onClick={() => a.run(() => postManualJournalAction(v), () => setV(blank))}>
              {a.pending ? "Menyimpan..." : "Catat jurnal"}
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

export function ReverseJournalButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await reverseManualJournalAction(id, reason);
      if (!r.ok) return setError(r.error);
      toast.success("Jurnal pembalik dicatat.");
      setOpen(false);
      router.refresh();
    });
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Undo2 className="size-3.5" /> Balik jurnal
      </Button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan pembalikan" className={cn(inputClass, "h-9 w-48 px-3")} />
      <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3} onClick={submit}>
        Balik
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Tidak
      </Button>
      <FormError message={error} />
    </span>
  );
}

// ---------------------------------------------------------------------------- Akun & kas/bank

export function AccountDialog({ item }: { item?: AccountRow }) {
  const a = useDialogAction(item ? "Akun diperbarui." : "Akun ditambahkan.");
  const blank = { code: item?.code ?? "", name: item?.name ?? "", type: item?.type ?? "expense" };
  const [v, setV] = useState(blank);
  return (
    <>
      <Button variant={item ? "ghost" : "outline"} size={item ? "sm" : "default"} onClick={() => a.setOpen(true)}>
        {item ? "Ubah" : (<><Plus className="size-4" /> Akun</>)}
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title={item ? `Ubah akun ${item.code}` : "Akun baru"} description={item ? "Hanya nama yang bisa diubah." : "Awalan kode mengikuti jenis: 1 aset, 2 kewajiban, 3 modal, 4 pendapatan, 5 HPP, 6 beban, 7 lain-lain."} size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode">
              <input value={v.code} disabled={Boolean(item)} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="6-1800" className={inputClass} />
            </Field>
            <Field label="Jenis">
              <select value={v.type} disabled={Boolean(item)} onChange={(e) => setV({ ...v, type: e.target.value as typeof v.type })} className={inputClass}>
                {(Object.keys(ACCOUNT_TYPE_LABEL) as (keyof typeof ACCOUNT_TYPE_LABEL)[]).map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Nama akun">
            <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="mis. Beban Internet" className={inputClass} />
          </Field>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => saveAccountAction(item?.id ?? null, v))}>
              {a.pending ? "Menyimpan..." : "Simpan"}
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

export function ToggleAccountButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setAccountActiveAction(id, !active);
          if (!r.ok) return void toast.error(r.error, { duration: 4000 });
          router.refresh();
        })
      }
    >
      {active ? "Nonaktifkan" : "Aktifkan"}
    </Button>
  );
}

export function CashBankDialog() {
  const a = useDialogAction("Akun kas/bank ditambahkan.");
  const blank = { name: "", kind: "bank" as "cash" | "bank", bank_name: "", account_number: "" };
  const [v, setV] = useState(blank);
  return (
    <>
      <Button variant="outline" onClick={() => a.setOpen(true)}>
        <Plus className="size-4" /> Akun kas/bank
      </Button>
      <FormDialog open={a.open} onOpenChange={a.setOpen} title="Akun kas/bank baru" description="Akun di bagan akun dibuat otomatis." size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Nama">
              <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="mis. Bank BCA" className={inputClass} />
            </Field>
            <Field label="Jenis">
              <select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as "cash" | "bank" })} className={inputClass}>
                <option value="bank">Bank</option>
                <option value="cash">Kas</option>
              </select>
            </Field>
          </div>
          {v.kind === "bank" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama bank">
                <input value={v.bank_name} onChange={(e) => setV({ ...v, bank_name: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Nomor rekening">
                <input value={v.account_number} onChange={(e) => setV({ ...v, account_number: e.target.value })} className={inputClass} />
              </Field>
            </div>
          )}
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => saveCashBankAction(null, v), () => setV(blank))}>
              {a.pending ? "Menyimpan..." : "Simpan"}
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

// ---------------------------------------------------------------------------- Tutup buku

export function PeriodControls({ year, month, closed, canClose, canReopen }: { year: number; month: number; closed: boolean; canClose: boolean; canReopen: boolean }) {
  const router = useRouter();
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, message: string) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setReopening(false);
      setReason("");
      toast.success(message);
      router.refresh();
    });
  if (closed && !canReopen) return null;
  if (!closed && !canClose) return null;
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {!closed && (
        <Button size="sm" disabled={pending} onClick={() => run(() => closePeriodAction(year, month), "Periode ditutup.")}>
          Tutup buku
        </Button>
      )}
      {closed && !reopening && (
        <Button size="sm" variant="ghost" onClick={() => setReopening(true)}>
          Buka kembali
        </Button>
      )}
      {closed && reopening && (
        <>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan membuka" aria-label="Alasan membuka periode" className={cn(inputClass, "h-9 w-52 px-3")} />
          <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(() => reopenPeriodAction(year, month, reason), "Periode dibuka kembali.")}>
            Buka
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setReopening(false)}>
            Tidak
          </Button>
        </>
      )}
      <FormError message={error} />
    </span>
  );
}
