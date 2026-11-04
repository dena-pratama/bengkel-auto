import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
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
import { CreateOpnameDialog } from "./_components/create-dialog";
import { OpnameList } from "./_components/opname-list";

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
