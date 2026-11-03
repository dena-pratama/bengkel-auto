"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { formatRupiah } from "@/lib/format";
import { BUSINESS_FORMS, BUSINESS_FORM_LABEL, PPH_MODES, PPH_MODE_LABEL, type TaxPaymentInput, type TaxSettingsInput } from "@/lib/validation/tax";
import { cn } from "@/lib/utils";
import { addTaxRateAction, postPphFinalAction, postTaxPaymentAction, saveTaxSettingsAction, voidPphFinalAction, voidTaxPaymentAction } from "../actions";

type Result = { ok: true } | { ok: false; error: string };

const Field = ({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) => (
  <label className={cn("grid gap-1.5 text-sm font-medium", className)}>
    {label}
    {children}
    {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
  </label>
);

const Check = ({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: React.ReactNode }) => (
  <label className={cn("flex items-start gap-2 text-sm", disabled && "opacity-60")}>
    <input type="checkbox" className="mt-0.5 size-4 accent-brand-blue-ink" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <span>{children}</span>
  </label>
);

/** Profil pajak (PRD §12.1): bentuk usaha, PKP, saklar PPN, harga, dan pilihan PPh */
export function TaxSettingsForm({ defaults, readOnly }: { defaults: TaxSettingsInput; readOnly: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(defaults);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof TaxSettingsInput>(k: K, val: TaxSettingsInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await saveTaxSettingsAction(v);
      if (!r.ok) return setError(r.error);
      toast.success("Pengaturan pajak disimpan.");
      router.refresh();
    });

  return (
    <div className="grid gap-5">
      <section className={cn(panel, "grid gap-4")}>
        <h2 className="text-lg font-semibold">Profil usaha</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bentuk usaha" hint="Menentukan aturan PPh Final yang berlaku.">
            <select disabled={readOnly} value={v.business_form} onChange={(e) => set("business_form", e.target.value as TaxSettingsInput["business_form"])} className={inputClass}>
              {BUSINESS_FORMS.map((f) => (
                <option key={f} value={f}>
                  {BUSINESS_FORM_LABEL[f]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid content-end gap-2">
            <Check
              checked={v.is_pkp}
              disabled={readOnly}
              onChange={(c) => {
                set("is_pkp", c);
                if (!c) set("ppn_enabled", false);
              }}
            >
              Bengkel berstatus <strong>PKP</strong> (Pengusaha Kena Pajak)
            </Check>
          </div>
        </div>
      </section>

      <section className={cn(panel, "grid gap-4")}>
        <h2 className="text-lg font-semibold">PPN</h2>
        <Check checked={v.ppn_enabled} disabled={readOnly || !v.is_pkp} onChange={(c) => set("ppn_enabled", c)}>
          Hitung PPN di invoice. PPN Keluaran dan Masukan dicatat ke akun terpisah dan tidak mengurangi laba.
          {!v.is_pkp && <span className="block text-xs text-muted-foreground">PPN hanya bisa diaktifkan jika PKP.</span>}
        </Check>
        <div className="grid gap-3 sm:grid-cols-2">
          <Check checked={v.prices_include_ppn} disabled={readOnly || !v.ppn_enabled} onChange={(c) => set("prices_include_ppn", c)}>
            Harga jual sudah termasuk PPN
            <span className="block text-xs text-muted-foreground">Sistem memecah DPP dan PPN dari harga di nota.</span>
          </Check>
        </div>
      </section>

      <section className={cn(panel, "grid gap-4")}>
        <h2 className="text-lg font-semibold">Pajak penghasilan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cara menghitung PPh">
            <select disabled={readOnly} value={v.pph_mode} onChange={(e) => set("pph_mode", e.target.value as TaxSettingsInput["pph_mode"])} className={inputClass}>
              {PPH_MODES.map((m) => (
                <option key={m} value={m}>
                  {PPH_MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal setor tiap bulan" hint="Untuk pengingat setor PPh (1-28).">
            <input disabled={readOnly} inputMode="numeric" value={String(v.pph_due_day ?? "")} onChange={(e) => set("pph_due_day", e.target.value)} className={inputClass} />
          </Field>
        </div>

        {v.pph_mode === "final" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tarif PPh Final (%)">
              <input disabled={readOnly} inputMode="decimal" value={String(v.pph_final_rate ?? "")} onChange={(e) => set("pph_final_rate", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Batas omzet setahun (Rp)" hint="Peringatan muncul di 80% dan 95% batas ini.">
              <input disabled={readOnly} inputMode="numeric" value={String(v.annual_ceiling ?? "")} onChange={(e) => set("annual_ceiling", e.target.value)} className={inputClass} />
            </Field>
            {v.business_form === "orang_pribadi" && (
              <Field label="Omzet bebas PPh (Rp)" hint="Omzet pertama setahun yang tidak dikenai PPh (Orang Pribadi).">
                <input disabled={readOnly} inputMode="numeric" value={String(v.free_threshold ?? "")} onChange={(e) => set("free_threshold", e.target.value)} className={inputClass} />
              </Field>
            )}
            {v.business_form === "cv_firma_pt" && (
              <Field label="Fasilitas berlaku sampai" hint="CV, firma, dan PT biasa yang baru terdaftar tidak lagi bisa memakai tarif ini.">
                <input disabled={readOnly} type="date" value={v.facility_end_date} onChange={(e) => set("facility_end_date", e.target.value)} className={inputClass} />
              </Field>
            )}
          </div>
        )}
        {v.pph_mode === "final" && v.business_form === "cv_firma_pt" && (
          <p className="rounded-2xl bg-brand-sand-soft px-4 py-3 text-sm">
            PPh Final mungkin tidak berlaku untuk CV, firma, dan PT biasa. Isi tanggal akhir fasilitas, atau pilih estimasi tarif umum dan konsultasikan dengan konsultan pajak.
          </p>
        )}
        {v.pph_mode === "general" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tarif PPh umum (%)" hint="Default 22% (tarif umum PPh Badan). Hasilnya estimasi, bukan jurnal.">
              <input disabled={readOnly} inputMode="decimal" value={String(v.general_rate ?? "")} onChange={(e) => set("general_rate", e.target.value)} className={inputClass} />
            </Field>
          </div>
        )}
      </section>

      <FormError message={error} />
      {!readOnly && (
        <div>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Menyimpan..." : "Simpan pengaturan"}
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Modul ini membantu perhitungan dan pencatatan, bukan pengganti konsultan pajak. Aturan bisa berubah; tarif dan batas dapat diubah di sini tanpa memperbarui aplikasi.</p>
    </div>
  );
}

export function AddRateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ rate_percent: "12", dpp_numerator: "11", dpp_denominator: "12", valid_from: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await addTaxRateAction(v);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      toast.success("Tarif PPN ditambahkan.");
      router.refresh();
    });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Tarif baru
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Tarif PPN baru" description="Berlaku mulai tanggal tertentu. Tarif lama otomatis berakhir sehari sebelumnya, transaksi lama tetap memakai tarif lama." size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tarif (%)">
              <input inputMode="decimal" value={v.rate_percent} onChange={(e) => setV({ ...v, rate_percent: e.target.value })} className={inputClass} />
            </Field>
            <Field label="DPP pembilang">
              <input inputMode="numeric" value={v.dpp_numerator} onChange={(e) => setV({ ...v, dpp_numerator: e.target.value })} className={inputClass} />
            </Field>
            <Field label="DPP penyebut">
              <input inputMode="numeric" value={v.dpp_denominator} onChange={(e) => setV({ ...v, dpp_denominator: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label="Berlaku mulai">
            <input type="date" value={v.valid_from} onChange={(e) => setV({ ...v, valid_from: e.target.value })} className={inputClass} />
          </Field>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button disabled={pending} onClick={submit}>
              {pending ? "Menyimpan..." : "Simpan tarif"}
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

/** Posting PPh Final satu bulan, atau batalkan jika sudah diposting */
export function PphMonthAction({ year, month, summaryId, posted, canPost, pph }: { year: number; month: number; summaryId: string | null; posted: boolean; canPost: boolean; pph: number }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, message: string) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setVoiding(false);
      setReason("");
      toast.success(message);
      router.refresh();
    });
  if (!canPost) return null;
  if (!posted)
    return (
      <span className="grid justify-items-end gap-1">
        <Button size="sm" disabled={pending} onClick={() => run(() => postPphFinalAction(year, month), pph > 0 ? `PPh Final ${formatRupiah(pph)} diposting.` : "Bulan diposting (PPh nol).")}>
          Posting
        </Button>
        <FormError message={error} />
      </span>
    );
  if (!voiding)
    return (
      <Button size="sm" variant="ghost" onClick={() => setVoiding(true)}>
        <Undo2 className="size-3.5" /> Batalkan
      </Button>
    );
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan pembatalan" className={cn(inputClass, "h-9 w-44 px-3")} />
      <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3 || !summaryId} onClick={() => run(() => voidPphFinalAction(summaryId!, reason), "Posting dibatalkan.")}>
        Batalkan
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setVoiding(false)}>
        Tidak
      </Button>
      <FormError message={error} />
    </span>
  );
}

export function PayTaxDialog({ taxType, cashAccounts, today, year, month, suggested }: { taxType: "pph_final" | "ppn"; cashAccounts: { id: string; name: string }[]; today: string; year?: number; month?: number; suggested?: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blank: TaxPaymentInput = {
    tax_type: taxType,
    period_year: year ? String(year) : "",
    period_month: month ? String(month) : "",
    amount: suggested && suggested > 0 ? String(suggested) : "",
    pay_date: today,
    cash_bank_account_id: cashAccounts[0]?.id ?? "",
    reference: "",
  };
  const [v, setV] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await postTaxPaymentAction(v);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setV(blank);
      toast.success("Setoran dicatat.");
      router.refresh();
    });
  return (
    <>
      <Button onClick={() => setOpen(true)}>Catat setoran</Button>
      <FormDialog open={open} onOpenChange={setOpen} title={taxType === "pph_final" ? "Setor PPh Final" : "Setor PPN"} description="Mengurangi kas/bank dan hutang pajak." size="md">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal setor">
              <input type="date" max={today} value={String(v.pay_date)} onChange={(e) => setV({ ...v, pay_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Jumlah (Rp)">
              <input inputMode="numeric" value={String(v.amount ?? "")} onChange={(e) => setV({ ...v, amount: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label="Dibayar dari akun">
            <select value={v.cash_bank_account_id} onChange={(e) => setV({ ...v, cash_bank_account_id: e.target.value })} className={inputClass}>
              {cashAccounts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nomor referensi (NTPN, opsional)">
            <input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} className={inputClass} />
          </Field>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button disabled={pending} onClick={submit}>
              {pending ? "Menyimpan..." : "Simpan"}
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

export function VoidTaxPaymentButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await voidTaxPaymentAction(id, reason);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      toast.success("Setoran dibatalkan.");
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
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan pembatalan" className={cn(inputClass, "h-9 w-44 px-3")} />
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
