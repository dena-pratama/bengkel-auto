import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
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

export default function StockOpnamePage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  const canView =
    can(ctx, "stock_opname_count", "view", false) ||
    can(ctx, "stock_opname_approve", "view", false) ||
    can(ctx, "master_data", "view", false);

  if (!canView) return <NoAccess />;

  const canCreate =
    can(ctx, "stock_opname_count", "create", false) ||
    can(ctx, "stock_opname_approve", "approve", false);

  const [opnames, locations, categories, employees] = await Promise.all([
    listStockOpnames(),
    listOpnameLocations(),
    listOpnameCategories(),
    listOpnameEmployees(),
  ]);

  return (
    <>
      <PageHeader
        title="Stok Opname"
        description="Pencocokan stok fisik gudang dengan sistem, mode blind count, dan penyesuaian otomatis."
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
      <OpnameList items={opnames} />
    </>
  );
}
