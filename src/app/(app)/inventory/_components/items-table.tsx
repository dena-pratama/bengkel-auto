"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type FilterFn,
  type SortingState,
  type TableFeatures,
} from "@tanstack/react-table";
import { AlertTriangle, ArrowUpDown, ChevronRight, PackageSearch, Search } from "lucide-react";
import { LocalFilters, uniqueOptions } from "@/components/local-filter";
import { EmptyState, inputClass, panel } from "@/components/page-kit";
import type { ItemListRow } from "@/lib/inventory";
import { formatQty, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

const itemSearch: FilterFn<TableFeatures, ItemListRow> = (row, _id, value: string) => {
  const q = value.trim().toLowerCase();
  if (!q) return true;
  const i = row.original;
  return [i.name, i.sku, i.brand, i.category, ...i.part_numbers, ...i.compat].filter(Boolean).some((v) => v!.toLowerCase().includes(q));
};

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { itemSearch },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});
const col = createColumnHelper<typeof features, ItemListRow>();

const isLow = (i: ItemListRow) => i.is_active && i.min_stock > 0 && i.qty <= i.min_stock;

function StockCell({ item }: { item: ItemListRow }) {
  const low = isLow(item);
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", low && "text-brand-red", item.qty < 0 && "text-brand-red")}>
      {low && <AlertTriangle className="size-3.5" />}
      {formatQty(item.qty)} <span className="font-normal text-muted-foreground">{item.unit}</span>
    </span>
  );
}

const columns = col.columns([
  col.accessor("name", {
    header: "Barang",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className={cn("truncate font-medium", !row.original.is_active && "text-muted-foreground line-through")}>{row.original.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{row.original.sku}</span>
          {row.original.part_numbers.length > 0 && ` · ${row.original.part_numbers.join(", ")}`}
        </p>
      </div>
    ),
  }),
  col.accessor((i) => i.category ?? "", { id: "category", header: "Kategori", sortFn: "alphanumeric", cell: (c) => c.getValue() || "-" }),
  col.accessor((i) => i.brand ?? "", { id: "brand", header: "Merek", sortFn: "alphanumeric", cell: (c) => c.getValue() || "-" }),
  col.accessor("qty", { header: "Stok", sortFn: "basic", cell: ({ row }) => <StockCell item={row.original} /> }),
  col.accessor("sell_price", { header: "Harga jual", sortFn: "basic", cell: (c) => <span className="tabular-nums">{formatRupiah(c.getValue())}</span> }),
]);

type Filter = "active" | "low" | "inactive" | "all";

export function ItemsTable({ items }: { items: ItemListRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  const counts = useMemo(
    () => ({
      active: items.filter((i) => i.is_active).length,
      low: items.filter(isLow).length,
      inactive: items.filter((i) => !i.is_active).length,
      all: items.length,
    }),
    [items],
  );
  const data = useMemo(
    () =>
      items.filter(
        (i) =>
          (filter === "all" ? true : filter === "active" ? i.is_active : filter === "low" ? isLow(i) : !i.is_active) &&
          (!category || i.category === category) &&
          (!brand || i.brand === brand),
      ),
    [items, filter, category, brand],
  );
  const categoryOptions = useMemo(() => uniqueOptions(items.map((i) => i.category)), [items]);
  const brandOptions = useMemo(() => uniqueOptions(items.map((i) => i.brand)), [items]);

  const table = useTable({
    features,
    columns,
    data,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    globalFilterFn: "itemSearch",
    getColumnCanGlobalFilter: (column) => column.id === "name",
  });
  const rows = table.getRowModel().rows;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "active", label: "Aktif" },
    { key: "low", label: "Stok menipis" },
    { key: "inactive", label: "Nonaktif" },
    { key: "all", label: "Semua" },
  ];

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, SKU, part number, merek…"
            aria-label="Cari barang"
            className={cn(inputClass, "pl-9")}
          />
        </label>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label="Filter barang">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key
                  ? f.key === "low"
                    ? "bg-brand-red text-white"
                    : "bg-brand-rail text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", filter === f.key ? "bg-white/20 text-white" : "bg-card text-muted-foreground")}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <LocalFilters
        selects={[
          { key: "kategori", label: "Kategori", value: category, options: categoryOptions, allLabel: "Semua kategori", onChange: setCategory },
          { key: "merek", label: "Merek", value: brand, options: brandOptions, allLabel: "Semua merek", onChange: setBrand },
        ]}
        dirty={Boolean(category || brand)}
        onReset={() => {
          setCategory("");
          setBrand("");
        }}
      />

      {rows.length === 0 ? (
        <EmptyState icon={PackageSearch} text={items.length === 0 ? "Belum ada barang. Tambahkan barang pertama." : "Tidak ada barang yang cocok."} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                    {hg.headers.map((h) => (
                      <th key={h.id} className={cn("px-3 py-2.5 font-medium", ["qty", "sell_price"].includes(h.column.id) && "text-right")}>
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-foreground">
                          <table.FlexRender header={h} />
                          <ArrowUpDown className="size-3" />
                        </button>
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/inventory/barang/${row.original.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className={cn("max-w-72 px-3 py-3", ["qty", "sell_price"].includes(cell.column.id) && "text-right")}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                    <td className="px-2">
                      <Link href={`/inventory/barang/${row.original.id}`} aria-label={`Buka ${row.original.name}`} onClick={(e) => e.stopPropagation()}>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-2 md:hidden">
            {rows.map(({ original: i }) => (
              <li key={i.id}>
                <Link href={`/inventory/barang/${i.id}`} className="grid gap-1 rounded-sm border border-border p-3 transition-colors hover:bg-muted/60">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn("min-w-0 font-medium", !i.is_active && "text-muted-foreground line-through")}>{i.name}</p>
                    <StockCell item={i} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{i.sku}</span>
                    {i.brand && ` · ${i.brand}`}
                    {i.category && ` · ${i.category}`}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{formatRupiah(i.sell_price)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
