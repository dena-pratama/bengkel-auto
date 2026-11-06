"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { TOAST_MS } from "@/components/app-toaster";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SettingsValues } from "@/lib/validation/settings";
import { saveSettingsAction } from "./actions";
import {
  PercentIcon,
  PackageIcon,
  InfoIcon,
  ArrowRightIcon,
  CheckIcon,
} from "lucide-react";

type Draft = Record<keyof SettingsValues, string | boolean>;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-foreground">
      {label}
      {children}
      {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-brand-blue/40",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      <div className="grid gap-0.5 text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-[var(--brand-blue)]"
      />
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

  const reset = () => {
    setV(Object.fromEntries(Object.entries(initial).map(([k, x]) => [k, typeof x === "number" ? String(x) : x])) as Draft);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card: Diskon dan Retur */}
        <section className={cn(panel, "space-y-5 rounded-2xl p-6 shadow-xs")}>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-blue-soft text-brand-blue">
              <PercentIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Diskon dan retur</h2>
              <p className="text-xs text-muted-foreground">Batas yang perlu PIN untuk disetujui.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Batas diskon Kasir (%)" hint="Di atas batas ini perlu PIN.">
                <input
                  disabled={readOnly}
                  inputMode="decimal"
                  value={String(v.discount_limit_cashier)}
                  onChange={(e) => set("discount_limit_cashier", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Batas diskon Admin (%)" hint="Di atas batas ini perlu PIN Owner. Owner tanpa batas.">
                <input
                  disabled={readOnly}
                  inputMode="decimal"
                  value={String(v.discount_limit_admin)}
                  onChange={(e) => set("discount_limit_admin", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Batas hari retur penjualan" hint="Dihitung dari tanggal nota; lewat batas perlu PIN.">
              <div className="flex items-center gap-2">
                <input
                  disabled={readOnly}
                  inputMode="numeric"
                  value={String(v.sales_return_max_days)}
                  onChange={(e) => set("sales_return_max_days", e.target.value)}
                  className={inputClass}
                />
                <span className="text-xs font-medium text-muted-foreground">hari</span>
              </div>
            </Field>
          </div>
        </section>

        {/* Card: Stok dan Part */}
        <section className={cn(panel, "space-y-5 rounded-2xl p-6 shadow-xs")}>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <PackageIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Stok dan part</h2>
              <p className="text-xs text-muted-foreground">Aturan stok, opname, dan pengeluaran part.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Ambang selisih opname (Rp)" hint="Selisih nilai di atas ini perlu PIN Owner saat opname diposting.">
              <input
                disabled={readOnly}
                inputMode="numeric"
                value={String(v.opname_pin_threshold)}
                onChange={(e) => set("opname_pin_threshold", e.target.value)}
                className={inputClass}
              />
            </Field>

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
          </div>
        </section>
      </div>

      {/* Info Note Banner */}
      <div className="flex items-center justify-between rounded-xl border border-brand-blue-border bg-brand-blue-soft/30 p-4 text-xs">
        <div className="flex items-center gap-2.5 text-foreground">
          <InfoIcon className="size-4 shrink-0 text-brand-blue" />
          <span>
            PPN dan PPh diatur di menu Pajak. Zona waktu operasional tetap Asia/Jakarta dan sesi otomatis keluar setelah 12 jam tidak aktif.
          </span>
        </div>
        <Link href="/pajak" className="inline-flex items-center gap-1 font-semibold text-brand-blue hover:underline">
          Buka Pajak <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>

      <FormError message={error} />

      {!readOnly && (
        <div className="flex items-center justify-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <Button type="button" variant="outline" disabled={pending} onClick={reset} className="rounded-xl">
            Batal
          </Button>
          <Button disabled={pending} onClick={submit} className="rounded-xl">
            <CheckIcon className="size-4" />
            {pending ? "Menyimpan..." : "Simpan pengaturan"}
          </Button>
        </div>
      )}
    </div>
  );
}
