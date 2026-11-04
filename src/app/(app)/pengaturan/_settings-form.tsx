"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TOAST_MS } from "@/components/app-toaster";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SettingsValues } from "@/lib/validation/settings";
import { saveSettingsAction } from "./actions";

type Draft = Record<keyof SettingsValues, string | boolean>;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl bg-muted/60 p-4", disabled && "cursor-not-allowed opacity-70")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand-blue)]" />
      <span className="grid gap-0.5 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ initial, readOnly }: { initial: SettingsValues; readOnly: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<Draft>(() => Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, typeof x === "number" ? String(x) : x])) as Draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof SettingsValues, val: string | boolean) => setV((x) => ({ ...x, [k]: val }));

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveSettingsAction(v as never);
      if (!r.ok) return setError(r.error);
      toast.success("Pengaturan tersimpan.", { duration: TOAST_MS.action });
      router.refresh();
    });

  return (
    <div className="grid gap-5">
      <section className={cn(panel, "grid gap-4")}>
        <h2 className="text-lg font-semibold">Diskon dan retur</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Batas diskon Kasir (%)" hint="Di atas batas ini perlu PIN.">
            <input disabled={readOnly} inputMode="decimal" value={String(v.discount_limit_cashier)} onChange={(e) => set("discount_limit_cashier", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Batas diskon Admin (%)" hint="Di atas batas ini perlu PIN Owner. Owner tanpa batas.">
            <input disabled={readOnly} inputMode="decimal" value={String(v.discount_limit_admin)} onChange={(e) => set("discount_limit_admin", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Batas hari retur penjualan" hint="Dihitung dari tanggal nota; lewat batas perlu PIN.">
            <input disabled={readOnly} inputMode="numeric" value={String(v.sales_return_max_days)} onChange={(e) => set("sales_return_max_days", e.target.value)} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className={cn(panel, "grid gap-4")}>
        <h2 className="text-lg font-semibold">Stok dan part</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ambang selisih opname (Rp)" hint="Selisih nilai di atas ini perlu PIN Owner saat opname diposting.">
            <input disabled={readOnly} inputMode="numeric" value={String(v.opname_pin_threshold)} onChange={(e) => set("opname_pin_threshold", e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Toggle
          disabled={readOnly}
          checked={v.allow_negative_stock === true}
          onChange={(c) => set("allow_negative_stock", c)}
          label="Izinkan stok minus"
          hint="Jual dulu, terima barang menyusul. Matikan agar penjualan ditolak bila stok tidak cukup."
        />
        <Toggle
          disabled={readOnly}
          checked={v.part_issue_require_scan === true}
          onChange={(c) => set("part_issue_require_scan", c)}
          label="Wajib scan QR saat mengeluarkan part"
          hint="Gudang harus scan QR barang dan rak. Pengeluaran manual ditolak."
        />
      </section>

      <p className="text-sm text-muted-foreground">PPN dan PPh diatur di menu Pajak. Zona waktu tetap Asia/Jakarta dan sesi otomatis keluar setelah 12 jam tidak aktif.</p>
      <FormError message={error} />
      {!readOnly && (
        <div>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Menyimpan..." : "Simpan pengaturan"}
          </Button>
        </div>
      )}
    </div>
  );
}
