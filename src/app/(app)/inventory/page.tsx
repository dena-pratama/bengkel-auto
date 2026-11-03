import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listBrands, listCategories, listItems, listLocations, listUnits } from "@/lib/inventory";
import { NewItemDialog } from "./_components/dialogs";
import { InventoryNav } from "./_components/nav";
import { ItemsTable } from "./_components/items-table";

export default function ItemsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <InventoryNav active="items" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const canCreate = can(ctx, "master_data", "create", false);
  const [items, lookups] = await Promise.all([
    listItems(),
    canCreate
      ? Promise.all([listCategories(), listBrands(), listUnits(), listLocations()]).then(([categories, brands, units, locations]) => ({ categories, brands, units, locations }))
      : Promise.resolve(null),
  ]);
  const low = items.filter((i) => i.is_active && i.min_stock > 0 && i.qty <= i.min_stock).length;

  return (
    <>
      <PageHeader
        title="Barang"
        description={`${items.filter((i) => i.is_active).length} barang aktif${low ? ` · ${low} stok menipis` : ""}`}
        actions={
          lookups && <NewItemDialog lookups={lookups} canSetPrice={can(ctx, "price_change", "create", false)} />
        }
      />
      <ItemsTable items={items} />
    </>
  );
}
