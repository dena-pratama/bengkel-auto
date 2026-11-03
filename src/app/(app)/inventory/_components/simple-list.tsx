"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Layers, Search, Wrench } from "lucide-react";
import { EmptyState, inputClass, panel } from "@/components/page-kit";
import { cn } from "@/lib/utils";

export type SimpleRow = {
  id: string;
  href: string;
  title: string;
  code: string;
  meta: string[];
  value: string;
  is_active: boolean;
};

// Ikon dipilih lewat kunci: komponen (fungsi) tidak bisa dikirim dari Server ke Client Component
const ICONS = { services: Wrench, packages: Layers };

/** Daftar ringkas dengan pencarian & filter aktif (dipakai Jasa & Paket). */
export function SimpleList({ rows, empty, searchLabel, icon }: { rows: SimpleRow[]; empty: string; searchLabel: string; icon: keyof typeof ICONS }) {
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) => (showInactive || r.is_active) && (!q || [r.title, r.code, ...r.meta].some((v) => v.toLowerCase().includes(q))),
    );
  }, [rows, query, showInactive]);
  const inactive = rows.filter((r) => !r.is_active).length;

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className={cn(inputClass, "pl-9")}
          />
        </label>
        {inactive > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-[var(--brand-blue-ink)]" />
            Tampilkan nonaktif ({inactive})
          </label>
        )}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={ICONS[icon]} text={rows.length === 0 ? empty : "Tidak ada yang cocok."} />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((r) => (
            <li key={r.id}>
              <Link
                href={r.href}
                className={cn("flex h-full items-center gap-3 rounded-sm border border-border p-3 transition-colors hover:bg-muted/60", !r.is_active && "opacity-60")}
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="truncate font-medium">
                    {r.title}
                    {!r.is_active && <span className="ml-2 rounded-sm bg-brand-red-soft px-1.5 py-0.5 text-2xs text-brand-red">Nonaktif</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{r.code}</span>
                    {r.meta.filter(Boolean).map((m) => ` · ${m}`)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{r.value}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
