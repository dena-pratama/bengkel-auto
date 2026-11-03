"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Receipt, Search } from "lucide-react";
import { EmptyState, inputClass, panel } from "@/components/page-kit";
import type { SaleRow } from "@/lib/cashier";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PaidBadge, SaleStatusBadge } from "./ui";

const norm = (v: string) => v.toLowerCase().replace(/[\s.-]/g, "");
const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "unpaid", label: "Belum lunas" },
  { key: "void", label: "Dibatalkan" },
] as const;

export function SalesList({ sales }: { sales: SaleRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const shown = useMemo(() => {
    const q = norm(query);
    return sales.filter((s) => {
      if (filter === "unpaid" ? !(s.status === "posted" && s.outstanding > 0) : filter === "void" ? s.status !== "void" : s.status === "void") return false;
      return !q || [s.sale_no ?? "", s.plate_no ?? "", s.customer_name ?? "", s.wo_no ?? ""].some((x) => norm(x).includes(q));
    });
  }, [sales, query, filter]);

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor invoice, plat, pelanggan, WO…" aria-label="Cari penjualan" className={cn(inputClass, "pl-9")} />
        </label>
        <div className="flex gap-1" role="tablist" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn("rounded-sm px-3 py-2 text-sm font-medium", filter === f.key ? "bg-brand-blue-ink text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Receipt} text="Tidak ada transaksi yang cocok." />
      ) : (
        <ul className="grid divide-y divide-border">
          {shown.map((s) => (
            <li key={s.id}>
              <Link href={`/kasir/penjualan/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold">
                    {s.sale_no ?? "Draft"} <span className="font-normal text-muted-foreground">· {s.source === "work_order" ? `WO ${s.wo_no ?? ""}` : "Penjualan part"}</span>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[s.plate_no, s.customer_name ?? "Umum"].filter(Boolean).join(" · ")} · {formatDate(s.sale_date)}
                  </p>
                </div>
                {s.status === "posted" ? <PaidBadge total={s.total} outstanding={s.outstanding} overdue={s.days_overdue} /> : <SaleStatusBadge status={s.status} />}
                <span className="w-32 text-right font-semibold tabular-nums">{formatRupiah(s.total)}</span>
                <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
