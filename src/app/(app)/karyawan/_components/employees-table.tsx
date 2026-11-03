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
  tableFeatures,
  useTable,
  type FilterFn,
  type SortingState,
  type TableFeatures,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronRight, KeyRound, Search, UserX } from "lucide-react";
import type { Employee } from "@/lib/employees";
import { STATUS_LABEL, type EmployeeStatus } from "@/lib/validation/employee";
import { cn } from "@/lib/utils";
import { Avatar, RoleChips, StatusBadge, inputClass, panel } from "./ui";

// Cari di semua teks karyawan sekaligus (nama, kode, jabatan, HP, email, role)
const employeeSearch: FilterFn<TableFeatures, Employee> = (row, _id, value: string) => {
  const q = value.trim().toLowerCase();
  if (!q) return true;
  const e = row.original;
  return [e.full_name, e.code, e.position, e.phone, e.email, ...e.roles.map((r) => r.name)]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
};

// TanStack Table v9: fitur didaftarkan eksplisit, di luar render agar stabil
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { employeeSearch },
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
const col = createColumnHelper<typeof features, Employee>();

const columns = col.columns([
  col.accessor("full_name", {
    header: "Karyawan",
    sortFn: "alphanumeric",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={row.original.full_name} />
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.full_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      </div>
    ),
  }),
  col.accessor((e) => e.position ?? "", { id: "position", header: "Jabatan", sortFn: "alphanumeric", cell: (c) => c.getValue() || "—" }),
  col.display({ id: "roles", header: "Role", cell: ({ row }) => <RoleChips roles={row.original.roles} /> }),
  col.accessor((e) => e.email ?? "", {
    id: "email",
    header: "Akun login",
    sortFn: "alphanumeric",
    cell: (c) =>
      c.getValue() ? (
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{c.getValue()}</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Belum ada</span>
      ),
  }),
  col.accessor("status", { header: "Status", sortFn: "alphanumeric", cell: (c) => <StatusBadge status={c.getValue()} /> }),
]);

const FILTERS: { key: "all" | EmployeeStatus; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "active", label: STATUS_LABEL.active },
  { key: "on_leave", label: STATUS_LABEL.on_leave },
  { key: "inactive", label: STATUS_LABEL.inactive },
];

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | EmployeeStatus>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "full_name", desc: false }]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: employees.length };
    for (const e of employees) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [employees]);

  const data = useMemo(() => (status === "all" ? employees : employees.filter((e) => e.status === status)), [employees, status]);

  const table = useTable({
    features,
    columns,
    data,
    state: { sorting, globalFilter: query },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    globalFilterFn: "employeeSearch",
    // Satu kolom cukup: fungsi pencarian memeriksa seluruh data baris
    getColumnCanGlobalFilter: (column) => column.id === "full_name",
  });
  const rows = table.getRowModel().rows;

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, kode, jabatan, role…"
            aria-label="Cari karyawan"
            className={cn(inputClass, "pl-9")}
          />
        </label>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="tablist" aria-label="Filter status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={status === f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                status === f.key ? "bg-brand-blue-ink text-white" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("rounded-sm px-1.5 text-xs tabular-nums", status === f.key ? "bg-white/20" : "bg-card")}>
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <UserX className="size-8" strokeWidth={1.5} />
          <p className="text-sm">Tidak ada karyawan yang cocok.</p>
        </div>
      ) : (
        <>
          {/* Tablet & desktop: tabel */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border text-left text-xs text-muted-foreground">
                    {hg.headers.map((h) => (
                      <th key={h.id} className="px-3 py-2 font-medium">
                        {h.column.getCanSort() ? (
                          <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-foreground">
                            <table.FlexRender header={h} />
                            <ArrowUpDown className="size-3" />
                          </button>
                        ) : (
                          <table.FlexRender header={h} />
                        )}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/karyawan/${row.original.id}`)}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60"
                  >
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id} className="max-w-64 px-3 py-3 align-middle">
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                    <td className="px-2">
                      <Link href={`/karyawan/${row.original.id}`} aria-label={`Buka ${row.original.full_name}`} onClick={(e) => e.stopPropagation()}>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* HP: kartu */}
          <ul className="grid gap-2 md:hidden">
            {rows.map(({ original: e }) => (
              <li key={e.id}>
                <Link href={`/karyawan/${e.id}`} className="flex items-start gap-3 rounded-sm border border-border p-3 transition-colors hover:bg-muted/60">
                  <Avatar name={e.full_name} />
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{e.code}</span>
                          {e.position && ` · ${e.position}`}
                        </p>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                    <RoleChips roles={e.roles} />
                    <p className="truncate text-xs text-muted-foreground">{e.email ?? "Belum ada akun login"}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
