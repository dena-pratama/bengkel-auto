import { Suspense } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { ListFilter } from "@/components/list-filter";
import { can, requireUser } from "@/lib/auth";
import { formatDate, todayWib } from "@/lib/format";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { OPNAME_STATUSES, OPNAME_STATUS_LABEL, OPNAME_TYPES, OPNAME_TYPE_LABEL } from "@/lib/validation/stock-opname";
import {
  listOpnameCategories,
  listOpnameEmployees,
  listOpnameLocations,
  listStockOpnames,
} from "@/lib/stock-opname";
import { cn } from "@/lib/utils";
import { CreateOpnameDialog } from "./_components/create-dialog";
import { OpnameList } from "./_components/opname-list";
import { formatRp } from "./_components/ui";

export const metadata = {
  title: "Stok Opname",
};

export default function StockOpnamePage({ searchParams }: PageProps<"/stok-opname">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  const canView =
    can(ctx, "stock_opname_count", "view", false) ||
    can(ctx, "stock_opname_approve", "view", false) ||
    can(ctx, "master_data", "view", false);

  if (!canView) return <NoAccess />;

  const canCreate =
    can(ctx, "stock_opname_count", "create", false) ||
    can(ctx, "stock_opname_approve", "approve", false);

  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "bulan-ini");
  const status = readOption(sp, "status", OPNAME_STATUSES);
  const type = readOption(sp, "jenis", OPNAME_TYPES);
  const [opnames, locations, categories, employees] = await Promise.all([
    listStockOpnames({ from: range.from, to: range.to, status, type }),
    listOpnameLocations(),
    listOpnameCategories(),
    listOpnameEmployees(),
  ]);

  const inProgressCount = opnames.filter((o) => o.status === "in_progress").length;
  const reviewCount = opnames.filter((o) => o.status === "review").length;
  const postedOpnames = opnames.filter((o) => o.status === "posted");
  const avgAccuracy =
    postedOpnames.length > 0
      ? `${(postedOpnames.reduce((sum, o) => sum + o.accuracy_pct, 0) / postedOpnames.length).toFixed(1)}%`
      : "-";
  const totalVariance = opnames.reduce((sum, o) => sum + o.total_variance_amount, 0);

  return (
    <>
      <PageHeader
        title="Stok Opname"
        description={`${describeRange(range, formatDate)} · ${opnames.length} sesi. Pencocokan stok fisik gudang dengan sistem, mode blind count, dan penyesuaian otomatis.`}
        actions={
          canCreate ? (
            <CreateOpnameDialog
              locations={locations}
              categories={categories}
              employees={employees}
            />
          ) : null
        }
      />

      {/* Summary 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Sesi bulan ini */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
            <ClipboardList className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Sesi tercatat</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{opnames.length}</p>
            <p className="text-[11px] text-muted-foreground">{inProgressCount} sedang berjalan</p>
          </div>
        </section>

        {/* Akurasi rata-rata */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
            <CheckCircle2 className="size-5 text-brand-green" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Akurasi rata-rata</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{avgAccuracy}</p>
            <p className="text-[11px] text-muted-foreground">dari {postedOpnames.length} sesi selesai</p>
          </div>
        </section>

        {/* Menunggu peninjauan */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
            <AlertTriangle className="size-5 text-brand-sand" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Menunggu tinjauan</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{reviewCount} sesi</p>
            <p className="text-[11px] text-muted-foreground">perlu persetujuan</p>
          </div>
        </section>

        {/* Selisih nilai */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
            <AlertCircle className="size-5 text-brand-red" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Selisih nilai</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{formatRp(totalVariance)}</p>
            <p className="text-[11px] text-muted-foreground">dari sesi di filter</p>
          </div>
        </section>
      </div>

      <ListFilter
        today={today}
        range={range}
        defaultRange="bulan-ini"
        dateLabel="Tanggal dibuat"
        selects={[
          { name: "status", label: "Status", value: status, options: OPNAME_STATUSES.map((v) => ({ value: v, label: OPNAME_STATUS_LABEL[v] })), allLabel: "Semua status" },
          { name: "jenis", label: "Jenis opname", value: type, options: OPNAME_TYPES.map((v) => ({ value: v, label: OPNAME_TYPE_LABEL[v] })), allLabel: "Semua jenis" },
        ]}
      />
      <OpnameList items={opnames} />
    </>
  );
}
