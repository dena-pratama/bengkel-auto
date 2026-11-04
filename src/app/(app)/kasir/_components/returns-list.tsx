"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, RotateCcw, Search } from "lucide-react";
import { EmptyState, inputClass, panel } from "@/components/page-kit";
import type { SaleReturnRow } from "@/lib/cashier";
import { formatDate, formatRupiah } from "@/lib/format";
import { SETTLEMENT_LABEL } from "@/lib/validation/cashier";
import { cn } from "@/lib/utils";

const norm = (v: string) => v.toLowerCase().replace(/[\s.-]/g, "");


export function ReturnsList({ returns }: { returns: SaleReturnRow[] }) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = norm(query);
    return returns.filter((r) => {
      return (
        !q ||
        [r.return_no, r.sale_no ?? "", r.plate_no ?? "", r.customer_name ?? "", r.wo_no ?? ""].some((x) =>
          norm(x).includes(q),
        )
      );
    });
  }, [returns, query]);

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor retur, invoice, plat, pelanggan..."
            aria-label="Cari retur"
            className={cn(inputClass, "pl-9")}
          />
        </label>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={RotateCcw} text="Belum ada transaksi retur penjualan." />
      ) : (
        <ul className="grid divide-y divide-border">
          {shown.map((r) => (
            <li key={r.id}>
              <Link
                href={`/kasir/retur/${r.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-brand-red">{r.return_no}</span>
                    <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Nota {r.sale_no ?? "-"}
                    </span>
                    <span className="rounded-sm bg-brand-sand-soft px-2 py-0.5 text-xs font-medium">
                      {SETTLEMENT_LABEL[r.settlement]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[
                      r.customer_name ?? "Umum",
                      r.plate_no,
                      r.wo_no ? `WO ${r.wo_no}` : "POS",
                      formatDate(r.return_date),
                      `${r.item_count} barang`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-foreground">{formatRupiah(r.total)}</p>
                  <p className="text-[11px] text-muted-foreground">Alasan: {r.reason}</p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
