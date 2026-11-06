import { Suspense } from "react";
import { AlertCircle, AlertTriangle, Package, Wallet } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listBrands, listCategories, listItems, listLocations, listUnits } from "@/lib/inventory";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
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

  const activeCount = items.filter((i) => i.is_active).length;
  const lowCount = items.filter((i) => i.is_active && i.min_stock > 0 && i.qty > 0 && i.qty <= i.min_stock).length;
  const outOfStockCount = items.filter((i) => i.is_active && i.qty <= 0).length;
  const inventoryValue = items.reduce((sum, i) => sum + (i.qty > 0 ? i.qty * i.sell_price : 0), 0);

  return (
    <>
      <PageHeader
        title="Barang & suku cadang"
        description={`${activeCount} barang aktif${lowCount ? ` · ${lowCount} stok menipis` : ""}`}
        actions={
          lookups && <NewItemDialog lookups={lookups} canSetPrice={can(ctx, "price_change", "create", false)} />
        }
      />

      {/* Summary 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Stat/Total SKU aktif */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
            <Package className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total SKU aktif</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">dari {items.length} barang</p>
          </div>
        </section>

        {/* Stat/Nilai persediaan */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
            <Wallet className="size-5 text-brand-green" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Nilai persediaan</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{formatRupiah(inventoryValue)}</p>
            <p className="text-[11px] text-muted-foreground">harga jual estimasi</p>
          </div>
        </section>

        {/* Stat/Stok menipis */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
            <AlertTriangle className="size-5 text-brand-sand" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Stok menipis</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{lowCount} barang</p>
            <p className="text-[11px] text-muted-foreground">di bawah minimum</p>
          </div>
        </section>

        {/* Stat/Stok habis */}
        <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
            <AlertCircle className="size-5 text-brand-red" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Stok habis</p>
            <p className="text-xl font-semibold leading-tight tabular-nums">{outOfStockCount} barang</p>
            <p className="text-[11px] text-muted-foreground">perlu PO segera</p>
          </div>
        </section>
      </div>

      <ItemsTable items={items} />
    </>
  );
}
