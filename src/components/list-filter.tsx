"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { inputClass, panel } from "@/components/page-kit";
import { RANGE_PRESETS, presetRange, type RangeKey, type RangeValue } from "@/lib/list-filter";
import { cn } from "@/lib/utils";

export type FilterSelect = {
  name: string;
  label: string;
  /** Pilihan; nilai kosong ("semua") ditambahkan otomatis di awal */
  options: { value: string; label: string }[];
  value: string | null;
  allLabel?: string;
};

const chip = (active: boolean) =>
  cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors", active ? "bg-brand-rail text-white" : "bg-muted text-muted-foreground hover:text-foreground");

/**
 * Filter daftar yang rapi dan seragam: rentang tanggal (pilihan cepat + tanggal bebas) dan kategori.
 * Nilainya ditulis ke URL (dapat dibagikan, tahan muat ulang) dan dibaca server, jadi daftar yang punya batas baris
 * tetap benar untuk rentang apa pun. Perubahan langsung diterapkan.
 */
export function ListFilter({
  today,
  range,
  selects = [],
  defaultRange,
  extraParams = [],
  presets = ["hari-ini", "7-hari", "30-hari", "bulan-ini", "bulan-lalu", "tahun-ini", "semua"],
  dateLabel = "Tanggal",
}: {
  today: string;
  /** Nilai rentang dari server (readRange); tanpa ini bagian tanggal disembunyikan */
  range?: RangeValue;
  selects?: FilterSelect[];
  defaultRange?: RangeKey;
  /** Parameter URL lain yang ikut dibersihkan saat Atur ulang */
  extraParams?: string[];
  presets?: RangeKey[];
  dateLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const apply = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("hal");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const pickPreset = (key: RangeKey) => {
    if (key === "semua") return apply({ dari: null, sampai: null, rentang: "semua" });
    const r = presetRange(key, today);
    apply({ dari: r.from, sampai: r.to, rentang: null });
  };

  const names = ["dari", "sampai", "rentang", ...selects.map((s) => s.name), ...extraParams];
  const dirty = names.some((n) => params.has(n));
  const reset = () => apply(Object.fromEntries(names.map((n) => [n, null])));
  const shown = RANGE_PRESETS.filter((p) => presets.includes(p.key));

  return (
    <section className={cn(panel, "grid gap-4 p-4 transition-opacity sm:p-5", pending && "opacity-70")} aria-label="Filter daftar" aria-busy={pending}>
      {range && (
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{dateLabel}</span>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" role="group" aria-label="Rentang cepat">
                {shown.map((p) => (
                  <button key={p.key} type="button" aria-pressed={range.preset === p.key} onClick={() => pickPreset(p.key)} className={chip(range.preset === p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Dari
                <input type="date" value={range.from ?? ""} max={range.to ?? undefined} onChange={(e) => apply({ dari: e.target.value || null, sampai: range.to ?? null, rentang: null })} className={cn(inputClass, "w-40")} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Sampai
                <input type="date" value={range.to ?? ""} min={range.from ?? undefined} onChange={(e) => apply({ sampai: e.target.value || null, dari: range.from ?? null, rentang: null })} className={cn(inputClass, "w-40")} />
              </label>
            </div>
          </div>
        </div>
      )}
      {(selects.length > 0 || dirty) && (
        <div className="flex flex-wrap items-end gap-3">
          {selects.map((s) => (
            <label key={s.name} className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              {s.label}
              <select value={s.value ?? ""} onChange={(e) => apply({ [s.name]: e.target.value || null })} className={cn(inputClass, "min-w-40")}>
                <option value="">{s.allLabel ?? "Semua"}</option>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {dirty && (
            <button type="button" onClick={reset} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground" title={defaultRange ? "Kembali ke tampilan awal" : "Hapus filter"}>
              <RotateCcw className="size-3.5" /> Atur ulang
            </button>
          )}
        </div>
      )}
    </section>
  );
}
