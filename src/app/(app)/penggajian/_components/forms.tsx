"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { formatRupiah } from "@/lib/format";
import type { PayProfile, Payslip, PayrollStatus } from "@/lib/payroll";
import { cn } from "@/lib/utils";
import {
  approvePayrollAction,
  createLoanAction,
  createPeriodAction,
  payPayrollAction,
  reopenPayrollAction,
  repayLoanAction,
  savePayProfileAction,
  submitPayrollAction,
  updateSlipAction,
  voidLoanAction,
  voidPayrollAction,
} from "../actions";

type Result = { ok: true } | { ok: false; error: string };

const Field = ({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) => (
  <label className={cn("grid gap-1.5 text-sm font-medium", className)}>
    {label}
    {children}
    {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
  </label>
);

/** Jalankan aksi: toast saat berhasil, error tampil di bawah */
function useRun(success?: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, message?: string, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      after?.();
      toast.success(message ?? success ?? "Tersimpan.");
      router.refresh();
    });
  return { run, error, pending };
}

// ---------------------------------------------------------------------------- Profil gaji

export function PayProfileDialog({ profile }: { profile: PayProfile }) {
  const a = useRun("Profil gaji disimpan.");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    pay_type: (profile.pay_type ?? "monthly") as "monthly" | "daily",
    base_salary: profile.base_salary ? String(profile.base_salary) : "",
    fixed_allowances: profile.fixed_allowances.map((x) => ({ name: x.name, amount: String(x.amount) })),
  });
  return (
    <>
      <Button size="sm" variant={profile.pay_type ? "ghost" : "outline"} onClick={() => setOpen(true)}>
        {profile.pay_type ? "Ubah" : "Atur gaji"}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title={`Profil gaji ${profile.full_name}`} description="Dipakai otomatis saat membuat periode gaji." size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis gaji">
              <select value={v.pay_type} onChange={(e) => setV({ ...v, pay_type: e.target.value as "monthly" | "daily" })} className={inputClass}>
                <option value="monthly">Bulanan</option>
                <option value="daily">Harian</option>
              </select>
            </Field>
            <Field label={v.pay_type === "monthly" ? "Gaji pokok per bulan (Rp)" : "Tarif per hari (Rp)"}>
              <input inputMode="numeric" value={v.base_salary} onChange={(e) => setV({ ...v, base_salary: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Tunjangan tetap</p>
            {v.fixed_allowances.map((x, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
                <input aria-label="Nama tunjangan" placeholder="mis. Makan" value={x.name} onChange={(e) => setV({ ...v, fixed_allowances: v.fixed_allowances.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} className={inputClass} />
                <input aria-label="Jumlah" inputMode="numeric" placeholder="Rp" value={x.amount} onChange={(e) => setV({ ...v, fixed_allowances: v.fixed_allowances.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)) })} className={inputClass} />
                <Button type="button" variant="ghost" size="icon" aria-label="Hapus tunjangan" onClick={() => setV({ ...v, fixed_allowances: v.fixed_allowances.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setV({ ...v, fixed_allowances: [...v.fixed_allowances, { name: "", amount: "" }] })}>
                <Plus className="size-3.5" /> Tambah tunjangan
              </Button>
            </div>
          </div>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => savePayProfileAction(profile.employee_id, v), undefined, () => setOpen(false))}>
              {a.pending ? "Menyimpan..." : "Simpan"}
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

// ---------------------------------------------------------------------------- Periode

export function PeriodDialog({ today }: { today: string }) {
  const router = useRouter();
  const a = useRun();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ period_type: "monthly" as "monthly" | "weekly", start_date: monthStart, end_date: today, label: "" });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Periode gaji
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Periode gaji baru" description="Slip dibuat untuk semua karyawan yang sudah punya profil gaji. Komisi yang sudah diakui masuk otomatis." size="md">
        <div className="grid gap-4">
          <Field label="Jenis periode">
            <select value={v.period_type} onChange={(e) => setV({ ...v, period_type: e.target.value as "monthly" | "weekly" })} className={inputClass}>
              <option value="monthly">Bulanan</option>
              <option value="weekly">Mingguan</option>
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mulai">
              <input type="date" value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Selesai">
              <input type="date" value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label="Nama periode (opsional)">
            <input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} placeholder="mis. Gaji Oktober 2026" className={inputClass} />
          </Field>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button
              disabled={a.pending}
              onClick={() =>
                a.run(async () => {
                  const r = await createPeriodAction(v);
                  if (r.ok) router.push(`/penggajian/${r.data.id}`);
                  return r;
                }, "Periode gaji dibuat.", () => setOpen(false))
              }
            >
              {a.pending ? "Membuat..." : "Buat periode"}
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

/** Tombol alur sesuai status: kirim review, setujui, bayar, kembalikan, batalkan */
export function PeriodActions({
  id,
  status,
  net,
  canUpdate,
  canApprove,
  canVoid,
  cashAccounts,
  today,
}: {
  id: string;
  status: PayrollStatus;
  net: number;
  canUpdate: boolean;
  canApprove: boolean;
  canVoid: boolean;
  cashAccounts: { id: string; name: string }[];
  today: string;
}) {
  const a = useRun();
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ cash_bank_account_id: cashAccounts[0]?.id ?? "", pay_date: today });
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && canUpdate && (
          <Button disabled={a.pending} onClick={() => a.run(() => submitPayrollAction(id), "Dikirim untuk review Owner.")}>
            <ArrowRight className="size-4" /> Kirim untuk review
          </Button>
        )}
        {status === "review" && canApprove && (
          <Button disabled={a.pending} onClick={() => a.run(() => approvePayrollAction(id), "Gaji disetujui.")}>
            <CheckCircle2 className="size-4" /> Setujui
          </Button>
        )}
        {(status === "review" || status === "approved") && canUpdate && (
          <Button variant="outline" disabled={a.pending} onClick={() => a.run(() => reopenPayrollAction(id), "Dikembalikan ke Draft.")}>
            <Undo2 className="size-4" /> Kembalikan ke Draft
          </Button>
        )}
        {status === "approved" && canUpdate && <Button onClick={() => setPayOpen(true)}>Bayar gaji ({formatRupiah(net)})</Button>}
        {status !== "void" && canVoid && !voiding && (
          <Button variant="ghost" onClick={() => setVoiding(true)}>
            Batalkan periode
          </Button>
        )}
      </div>
      {voiding && (
        <div className="flex flex-wrap gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" className={cn(inputClass, "max-w-md flex-1")} />
          <Button variant="destructive" disabled={a.pending || reason.trim().length < 3} onClick={() => a.run(() => voidPayrollAction(id, reason), "Periode dibatalkan.", () => setVoiding(false))}>
            Batalkan
          </Button>
          <Button variant="ghost" onClick={() => setVoiding(false)}>
            Tidak jadi
          </Button>
        </div>
      )}
      <FormError message={a.error} />
      <FormDialog open={payOpen} onOpenChange={setPayOpen} title="Bayar gaji" description="Jurnal beban gaji dan kas keluar dibuat otomatis; kasbon dipotong dari saldo." size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dibayar dari akun">
              <select value={pay.cash_bank_account_id} onChange={(e) => setPay({ ...pay, cash_bank_account_id: e.target.value })} className={inputClass}>
                {cashAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal bayar">
              <input type="date" max={today} value={pay.pay_date} onChange={(e) => setPay({ ...pay, pay_date: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">Total gaji bersih yang keluar dari kas/bank: {formatRupiah(net)}.</p>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => payPayrollAction(id, pay), "Gaji dibayar.", () => setPayOpen(false))}>
              {a.pending ? "Memproses..." : "Bayar sekarang"}
            </Button>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

/** Input per slip selama Draft: hari masuk, lembur, bonus, potongan */
export function SlipEditor({ slip }: { slip: Payslip }) {
  const a = useRun("Slip diperbarui.");
  const [v, setV] = useState({
    days_worked: String(slip.days_worked),
    overtime_hours: String(slip.overtime_hours),
    overtime_rate: String(slip.overtime_rate),
    bonus_amount: String(slip.bonus_amount),
    other_deduction: String(slip.other_deduction),
    other_deduction_note: slip.other_deduction_note ?? "",
    loan_deduction: String(slip.loan_deduction),
    notes: slip.notes ?? "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="grid gap-3 rounded-2xl bg-muted/60 p-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {slip.pay_type === "daily" && (
          <Field label="Hari masuk">
            <input inputMode="decimal" value={v.days_worked} onChange={set("days_worked")} className={inputClass} />
          </Field>
        )}
        <Field label="Jam lembur">
          <input inputMode="decimal" value={v.overtime_hours} onChange={set("overtime_hours")} className={inputClass} />
        </Field>
        <Field label="Tarif lembur / jam (Rp)">
          <input inputMode="numeric" value={v.overtime_rate} onChange={set("overtime_rate")} className={inputClass} />
        </Field>
        <Field label="Bonus (Rp)">
          <input inputMode="numeric" value={v.bonus_amount} onChange={set("bonus_amount")} className={inputClass} />
        </Field>
        <Field label="Potongan kasbon (Rp)">
          <input inputMode="numeric" value={v.loan_deduction} onChange={set("loan_deduction")} className={inputClass} />
        </Field>
        <Field label="Potongan lain (Rp)" hint="BPJS, PPh 21, denda">
          <input inputMode="numeric" value={v.other_deduction} onChange={set("other_deduction")} className={inputClass} />
        </Field>
        <Field label="Keterangan potongan" className="sm:col-span-2">
          <input value={v.other_deduction_note} onChange={set("other_deduction_note")} placeholder="mis. BPJS Kesehatan" className={inputClass} />
        </Field>
      </div>
      <FormError message={a.error} />
      <div>
        <Button size="sm" disabled={a.pending} onClick={() => a.run(() => updateSlipAction(slip.id, v))}>
          {a.pending ? "Menyimpan..." : "Simpan slip"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- Kasbon

export function LoanDialog({ employees, cashAccounts, today }: { employees: { id: string; full_name: string }[]; cashAccounts: { id: string; name: string }[]; today: string }) {
  const a = useRun("Kasbon dicatat.");
  const blank = { employee_id: "", loan_date: today, principal: "", installment_amount: "", cash_bank_account_id: cashAccounts[0]?.id ?? "", note: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(blank);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Kasbon baru
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Kasbon baru" description="Dicairkan dari kas/bank, lalu dipotong otomatis dari gaji sesuai cicilan per periode." size="md">
        <div className="grid gap-4">
          <Field label="Karyawan">
            <select value={v.employee_id} onChange={(e) => setV({ ...v, employee_id: e.target.value })} className={inputClass}>
              <option value="">Pilih karyawan</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah kasbon (Rp)">
              <input inputMode="numeric" value={v.principal} onChange={(e) => setV({ ...v, principal: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Cicilan per periode (Rp)">
              <input inputMode="numeric" value={v.installment_amount} onChange={(e) => setV({ ...v, installment_amount: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Dicairkan dari akun">
              <select value={v.cash_bank_account_id} onChange={(e) => setV({ ...v, cash_bank_account_id: e.target.value })} className={inputClass}>
                {cashAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal">
              <input type="date" max={today} value={v.loan_date} onChange={(e) => setV({ ...v, loan_date: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label="Keterangan (opsional)">
            <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className={inputClass} />
          </Field>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => createLoanAction(v), undefined, () => { setOpen(false); setV(blank); })}>
              {a.pending ? "Menyimpan..." : "Simpan kasbon"}
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

export function RepayDialog({ loanId, balance, cashAccounts, today }: { loanId: string; balance: number; cashAccounts: { id: string; name: string }[]; today: string }) {
  const a = useRun("Pelunasan dicatat.");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ amount: String(balance), pay_date: today, cash_bank_account_id: cashAccounts[0]?.id ?? "" });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Bayar tunai
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Pelunasan kasbon" description={`Sisa kasbon ${formatRupiah(balance)}. Di luar potongan gaji.`} size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah (Rp)">
              <input inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Tanggal">
              <input type="date" max={today} value={v.pay_date} onChange={(e) => setV({ ...v, pay_date: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label="Diterima di akun">
            <select value={v.cash_bank_account_id} onChange={(e) => setV({ ...v, cash_bank_account_id: e.target.value })} className={inputClass}>
              {cashAccounts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <FormError message={a.error} />
          <div className="flex gap-2">
            <Button disabled={a.pending} onClick={() => a.run(() => repayLoanAction(loanId, v), undefined, () => setOpen(false))}>
              {a.pending ? "Menyimpan..." : "Simpan"}
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

export function VoidLoanButton({ id }: { id: string }) {
  const a = useRun("Kasbon dibatalkan.");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Batalkan
      </Button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan pembatalan" className={cn(inputClass, "h-9 w-44 px-3")} />
      <Button size="sm" variant="destructive" disabled={a.pending || reason.trim().length < 3} onClick={() => a.run(() => voidLoanAction(id, reason), undefined, () => setOpen(false))}>
        Batalkan
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Tidak
      </Button>
      <FormError message={a.error} />
    </span>
  );
}
