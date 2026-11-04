"use client";

import { RotateCcw } from "lucide-react";
import { inputClass } from "@/components/page-kit";
import { cn } from "@/lib/utils";

export type LocalSelect = {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  onChange: (value: string) => void;
};

/**
 * Filter untuk daftar yang seluruh datanya sudah dimuat di klien (barang, jasa, pelanggan, karyawan).
 * Tampilannya sama dengan ListFilter, tetapi nilainya disimpan di state komponen, bukan di URL.
 * Rentang tanggal opsional (mis. tanggal masuk karyawan).
 */
export function LocalFilters({
  selects,
  date,
  dirty,
  onReset,
}: {
  selects: LocalSelect[];
  date?: { label: string; from: string; to: string; onChange: (from: string, to: string) => void };
  dirty: boolean;
  onReset: () => void;
}) {
  if (selects.length === 0 && !date) return null;
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filter">
      {selects.map((s) => (
        <label key={s.key} className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          {s.label}
          <select value={s.value} onChange={(e) => s.onChange(e.target.value)} className={cn(inputClass, "min-w-40")}>
            <option value="">{s.allLabel ?? "Semua"}</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {date && (
        <>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            {date.label}: dari
            <input type="date" value={date.from} max={date.to || undefined} onChange={(e) => date.onChange(e.target.value, date.to)} className={cn(inputClass, "w-40")} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            sampai
            <input type="date" value={date.to} min={date.from || undefined} onChange={(e) => date.onChange(date.from, e.target.value)} className={cn(inputClass, "w-40")} />
          </label>
        </>
      )}
      {dirty && (
        <button type="button" onClick={onReset} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          <RotateCcw className="size-3.5" /> Atur ulang
        </button>
      )}
    </div>
  );
}

/** Pilihan unik dari sebuah daftar, terurut abjad, untuk mengisi LocalSelect */
export function uniqueOptions(values: (string | null | undefined)[]): { value: string; label: string }[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "id")).map((v) => ({ value: v, label: v }));
}
