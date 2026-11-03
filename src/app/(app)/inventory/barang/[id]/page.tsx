import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { getItem, getItemStock, listBrands, listCategories, listLocations, listUnits } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { ItemForm } from "../../_components/item-form";
import { StockPanel } from "../../_components/stock-panel";

export default function ItemDetailPage({ params }: PageProps<"/inventory/barang/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;

  const [item, stock, categories, brands, units, locations] = await Promise.all([
    getItem(id),
    getItemStock(id),
    listCategories(),
    listBrands(),
    listUnits(),
    listLocations(),
  ]);
  if (!item) notFound();
  const canUpdate = can(ctx, "master_data", "update", false);

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${item.sku}${item.is_active ? "" : " · Nonaktif"}`}
        back={{ href: "/inventory", label: "Barang" }}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ItemForm
          key={item.id}
          id={item.id}
          lookups={{ categories, brands, units, locations }}
          baseUnitLocked={item.has_movements}
          canSetPrice={can(ctx, "price_change", "create", false)}
          readOnly={!canUpdate}
          isActive={item.is_active}
          defaults={{
            sku: item.sku,
            name: item.name,
            category_id: item.category_id ?? "",
            brand_id: item.brand_id ?? "",
            base_unit_id: item.base_unit_id,
            sell_price: String(item.sell_price),
            min_stock: String(item.min_stock),
            default_location_id: item.default_location_id ?? "",
            warranty_days: String(item.warranty_days),
            is_taxable: item.is_taxable,
            notes: item.notes ?? "",
            units: item.units.map((u) => ({ unit_id: u.unit_id, factor: String(u.factor), is_purchase: u.is_purchase, is_sale: u.is_sale })),
            part_numbers: item.part_numbers,
          }}
        />
        <div className="grid content-start gap-4">
          <StockPanel
            itemId={item.id}
            unit={item.unit}
            minStock={item.min_stock}
            defaultLocationId={item.default_location_id}
            balances={stock.balances}
            movements={stock.movements}
            locations={locations}
            avgCost={stock.avgCost}
            canOpening={ctx.is_superuser}
            canTransfer={canUpdate || can(ctx, "stock_opname_count", "update", false)}
          />
          <section className={cn(panel, "grid gap-3")}>
            <h3 className="text-lg font-semibold">Riwayat harga jual</h3>
            <ul className="grid divide-y divide-border">
              {stock.prices.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-muted-foreground">{formatDateTime(p.created_at)}</span>
                  <span className="tabular-nums">
                    {p.old_price !== null && <span className="text-muted-foreground line-through">{formatRupiah(p.old_price)}</span>}{" "}
                    <span className="font-semibold">{formatRupiah(p.new_price)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
