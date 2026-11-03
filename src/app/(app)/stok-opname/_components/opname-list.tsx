"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { StockOpnameRow } from "@/lib/stock-opname";
import { OPNAME_STATUSES, OPNAME_STATUS_LABEL } from "@/lib/validation/stock-opname";
import { OpnameStatusBadge, OpnameTypeBadge, formatRp } from "./ui";

export function OpnameList({ items }: { items: StockOpnameRow[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const no = item.opname_no.toLowerCase();
        const notes = (item.notes ?? "").toLowerCase();
        const staff = (item.assigned_name ?? "").toLowerCase();
        if (!no.includes(q) && !notes.includes(q) && !staff.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, statusFilter, query]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 border-b border-border pb-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Semua ({items.length})
          </button>
          {OPNAME_STATUSES.map((st) => {
            const count = items.filter((x) => x.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === st
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {OPNAME_STATUS_LABEL[st]} ({count})
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor, catatan, petugas..."
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">No. Dokumen</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Petugas</th>
              <th className="px-4 py-3 text-right">Total Item</th>
              <th className="px-4 py-3 text-right">Akurasi</th>
              <th className="px-4 py-3 text-right">Selisih Nilai</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada sesi stok opname yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/stok-opname/${r.id}`}
                      className="font-mono text-primary underline-offset-4 hover:underline"
                    >
                      {r.opname_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <OpnameTypeBadge type={r.opname_type} />
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {r.assigned_name ?? <span className="text-muted-foreground">(Semua)</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.total_items}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "draft" ? (
                      <span className="text-xs text-muted-foreground">Belum mulai</span>
                    ) : (
                      <span
                        className={`font-semibold ${
                          r.accuracy_pct >= 98
                            ? "text-emerald-600 dark:text-emerald-400"
                            : r.accuracy_pct >= 90
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {r.accuracy_pct}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.total_variance_amount === 0 ? (
                      <span className="text-muted-foreground">Rp 0</span>
                    ) : (
                      <span
                        className={
                          r.total_variance_amount < 0
                            ? "font-semibold text-rose-600 dark:text-rose-400"
                            : "font-semibold text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {formatRp(r.total_variance_amount)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OpnameStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/stok-opname/${r.id}`}
                      className="inline-flex rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Buka
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
