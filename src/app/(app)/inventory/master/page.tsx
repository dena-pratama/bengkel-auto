import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listBrands, listCategories, listLocations, listServiceCategories, listUnits } from "@/lib/inventory";
import { LOCATION_TYPE_LABEL } from "@/lib/validation/inventory";
import { MasterEditor, type MasterRow } from "../_components/master-editor";
import { InventoryNav } from "../_components/nav";

export default function MasterPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <InventoryNav active="master" />
      <PageHeader title="Kategori, satuan & lokasi" description="Data pendukung barang & jasa. Data yang tidak dipakai lagi dinonaktifkan, bukan dihapus." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const [categories, brands, units, locations, serviceCategories] = await Promise.all([
    listCategories(),
    listBrands(),
    listUnits(),
    listLocations(),
    listServiceCategories(),
  ]);
  const canCreate = can(ctx, "master_data", "create", false);
  const canUpdate = can(ctx, "master_data", "update", false);
  const common = { canCreate, canUpdate };

  // Kategori: induk lalu subkategori di bawahnya
  const categoryRows: MasterRow[] = categories
    .filter((c) => !c.parent_id)
    .flatMap((p) => [
      { id: p.id, label: p.name, is_active: p.is_active, values: { name: p.name, parent_id: "" } },
      ...categories
        .filter((c) => c.parent_id === p.id)
        .map((c) => ({ id: c.id, label: c.name, depth: 1, is_active: c.is_active, values: { name: c.name, parent_id: p.id } })),
    ]);
  const parentOptions = [
    { value: "", label: "— Kategori utama —" },
    ...categories.filter((c) => !c.parent_id && c.is_active).map((c) => ({ value: c.id, label: `Sub dari ${c.name}` })),
  ];

  const locationRows: MasterRow[] = locations.map((l) => ({
    id: l.id,
    label: `${l.code} · ${l.name}`,
    sub: `${LOCATION_TYPE_LABEL[l.type]} · ${l.path}`,
    depth: l.type === "area" ? 0 : l.type === "rack" ? 1 : 2,
    is_active: l.is_active,
    values: { parent_id: l.parent_id ?? "", type: l.type, code: l.code, name: l.name },
  }));
  const locationParents = [
    { value: "", label: "— Tanpa induk (Area) —" },
    ...locations.filter((l) => l.type !== "bin" && l.is_active).map((l) => ({ value: l.id, label: `Di dalam ${l.path}` })),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MasterEditor
        {...common}
        kind="location"
        table="locations"
        title="Lokasi & rak"
        description="Struktur Area › Rak › Level/Bin, contoh GDG › A › A-02."
        rows={locationRows}
        emptyValues={{ parent_id: "", type: "area", code: "", name: "" }}
        fields={[
          {
            name: "type",
            label: "Tipe",
            options: (["area", "rack", "bin"] as const).map((t) => ({ value: t, label: LOCATION_TYPE_LABEL[t] })),
            className: "w-28",
          },
          { name: "parent_id", label: "Induk", options: locationParents, className: "min-w-40 flex-1" },
          { name: "code", label: "Kode", placeholder: "Kode (A-02)", className: "w-28 font-mono uppercase" },
          { name: "name", label: "Nama", className: "min-w-32 flex-1" },
        ]}
      />
      <MasterEditor
        {...common}
        kind="category"
        table="item_categories"
        title="Kategori barang"
        description="Dua tingkat: kategori › subkategori, contoh Mesin › Filter."
        rows={categoryRows}
        emptyValues={{ name: "", parent_id: "" }}
        fields={[
          { name: "name", label: "Nama kategori", className: "min-w-40 flex-1" },
          { name: "parent_id", label: "Induk", options: parentOptions, className: "min-w-40 flex-1" },
        ]}
      />
      <MasterEditor
        {...common}
        kind="unit"
        table="units"
        title="Satuan"
        description="Kode singkat dipakai di stok, contoh pcs, liter, set."
        rows={units.map((u) => ({ id: u.id, label: u.code, sub: u.name, is_active: u.is_active, values: { code: u.code, name: u.name } }))}
        emptyValues={{ code: "", name: "" }}
        fields={[
          { name: "code", label: "Kode", placeholder: "Kode (pcs)", className: "w-28 lowercase" },
          { name: "name", label: "Nama", className: "min-w-32 flex-1" },
        ]}
      />
      <MasterEditor
        {...common}
        kind="brand"
        table="brands"
        title="Merek"
        rows={brands.map((b) => ({ id: b.id, label: b.name, is_active: b.is_active, values: { name: b.name } }))}
        emptyValues={{ name: "" }}
        fields={[{ name: "name", label: "Nama merek", className: "min-w-40 flex-1" }]}
      />
      <MasterEditor
        {...common}
        kind="service_category"
        table="service_categories"
        title="Kategori jasa"
        rows={serviceCategories.map((c) => ({ id: c.id, label: c.name, is_active: c.is_active, values: { name: c.name } }))}
        emptyValues={{ name: "" }}
        fields={[{ name: "name", label: "Nama kategori jasa", className: "min-w-40 flex-1" }]}
      />
    </div>
  );
}
