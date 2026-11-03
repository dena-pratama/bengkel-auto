import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listBrands, listCategories, listLocations, listUnits } from "@/lib/inventory";
import { ItemForm } from "../../_components/item-form";

export default function NewItemPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <PageHeader title="Tambah barang" back={{ href: "/inventory", label: "Barang" }} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "create", false)) return <NoAccess />;
  const [categories, brands, units, locations] = await Promise.all([listCategories(), listBrands(), listUnits(), listLocations()]);
  const pcs = units.find((u) => u.code === "pcs");

  return (
    <ItemForm
      id={null}
      lookups={{ categories, brands, units, locations }}
      baseUnitLocked={false}
      canSetPrice={can(ctx, "price_change", "create", false)}
      readOnly={false}
      isActive
      defaults={{
        sku: "",
        name: "",
        category_id: "",
        brand_id: "",
        base_unit_id: pcs?.id ?? "",
        sell_price: "",
        min_stock: "",
        default_location_id: "",
        warranty_days: "",
        is_taxable: true,
        notes: "",
        units: [],
        part_numbers: [],
      }}
    />
  );
}
